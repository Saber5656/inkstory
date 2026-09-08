import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { reencode } from '@/capture/reencode';
import { cropRotate, type CropRect } from '@/capture/cropRotate';
import { applyBrush, MaskHistory, type BrushMode } from '@/vision/mask';
import { jointWarnings } from '@/pose/warnings';
import { cocoToSkeleton, meanConfidence } from '@/pose/mapping';
import { templateJoints } from '@/pose/template';
import type { JointMap, JointName } from '@/pose/mapping';
import { Dialog } from '@/ui/Dialog';
import { Preview } from './Preview';
import { Camera } from './Camera';
import { clampRect } from '@/capture/cropRotate';
import { nextStep, previousStep, steps, type Step } from './machine';
import {
  imagePixels,
  pixelsPng,
  prepareTexture,
  saveDrawingCharacter,
  segmentAsync,
} from './pipeline';
export default function Wizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('capture');
  const [pixels, setPixels] = useState<ImageData>();
  const [mask, setMask] = useState<Uint8Array>();
  const [crop, setCrop] = useState<CropRect>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  const [rotation, setRotation] = useState(0);
  const [fine, setFine] = useState(0);
  const [rigType, setRigType] = useState<'humanoid' | 'cutout'>('humanoid');
  const [typeChosen, setTypeChosen] = useState(false);
  const [brushPoint, setBrushPoint] = useState({ x: 0, y: 0 });
  const [joints, setJoints] = useState<JointMap>();
  const [texture, setTexture] =
    useState<Awaited<ReturnType<typeof prepareTexture>>>();
  const [name, setName] = useState(t('characterDefault'));
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const closeCamera = useCallback(() => setStream(undefined), []);
  const [zoom, setZoom] = useState(1);
  const cropStart = useRef<{ x: number; y: number }>();
  const zoomHost = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [leave, setLeave] = useState(false);
  const [mode, setMode] = useState<BrushMode>('erase');
  const [radius, setRadius] = useState(18);
  const [selected, setSelected] = useState<JointName>('neck');
  const [source, setSource] = useState<'file' | 'camera'>('file');
  const canvas = useRef<HTMLCanvasElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const history = useRef(new MaskHistory(30));
  const draft = useRef(false);
  const blocker = useBlocker(() => draft.current);
  const controller = useRef<AbortController>();
  const painting = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    draft.current = !!pixels;
  }, [pixels]);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (draft.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, []);
  useEffect(() => {
    const c = canvas.current;
    const image =
      step === 'joints' || step === 'preview' ? texture?.image : pixels;
    if (!c || !image) return;
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(image, 0, 0);
    if (step === 'mask' && mask) {
      const overlay = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) {
          overlay.data[i * 4] = Math.round(
            (overlay.data[i * 4] ?? 0) * 0.4 + 80,
          );
          overlay.data[i * 4 + 1] = Math.round(
            (overlay.data[i * 4 + 1] ?? 0) * 0.4 + 90,
          );
          overlay.data[i * 4 + 2] = Math.round(
            (overlay.data[i * 4 + 2] ?? 0) * 0.4 + 80,
          );
        }
      }
      ctx.putImageData(overlay, 0, 0);
    }
    if (step === 'mask') {
      ctx.beginPath();
      ctx.arc(brushPoint.x, brushPoint.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#bd492f';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (step === 'crop') {
      ctx.strokeStyle = '#bd492f';
      ctx.lineWidth = Math.max(3, c.width / 150);
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
    }
    if (step === 'joints' && joints) {
      for (const [key, point] of Object.entries(joints)) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(10, c.width / 35), 0, Math.PI * 2);
        ctx.fillStyle = key === selected ? '#e2b645' : '#bd492f';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }, [pixels, mask, step, texture, joints, selected, crop, brushPoint, radius]);
  async function openCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        camera.current?.click();
        return;
      }
      const active = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (!alive.current) {
        active.getTracks().forEach((track) => track.stop());
        return;
      }
      setStream(active);
    } catch {
      camera.current?.click();
    }
  }
  useEffect(() => {
    const c = canvas.current;
    const host = zoomHost.current;
    if (!c || !host) return;
    const image = step === 'joints' ? texture?.image : pixels;
    if (!image) return;
    const base = Math.min(
      host.clientWidth / image.width,
      Math.min(window.innerHeight * 0.65, 600) / image.height,
    );
    c.style.width = `${image.width * base * zoom}px`;
    c.style.maxWidth = 'none';
    c.style.maxHeight = 'none';
  }, [zoom, step, pixels, texture]);
  async function acquire(file: File | undefined, origin: 'file' | 'camera') {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const result = await reencode(file);
      const image = imagePixels(result.bitmap);
      result.bitmap.close();
      setPixels(image);
      setCrop({ x: 0, y: 0, width: image.width, height: image.height });
      setSource(origin);
      setStep('crop');
    } catch {
      setError(t('imageError'));
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = '';
      if (camera.current) camera.current.value = '';
    }
  }
  async function runAuto(image: ImageData) {
    controller.current?.abort();
    controller.current = new AbortController();
    const result = await segmentAsync(image, controller.current.signal);
    setMask(result.mask);
    if (mask) history.current.push(mask);
    if (!result.ok) setError(t('emptyMask'));
  }
  async function forward() {
    if (!pixels) return;
    setBusy(true);
    setError('');
    try {
      if (step === 'crop') {
        const bitmap = await createImageBitmap(await pixelsPng(pixels));
        const cropped = await cropRotate(bitmap, {
          rect: crop,
          rotationDeg: rotation + fine,
        });
        bitmap.close();
        const image = imagePixels(cropped);
        cropped.close();
        setPixels(image);
        setCrop({ x: 0, y: 0, width: image.width, height: image.height });
        setRotation(0);
        setFine(0);
        await runAuto(image);
      }
      if (step === 'mask' && mask) {
        if (!mask.some((value) => value > 0)) {
          setError(t('emptyMask'));
          return;
        }
        const result = await prepareTexture(pixels, mask);
        setTexture(result);
        setJoints(
          templateJoints({
            x: 0,
            y: 0,
            width: result.image.width,
            height: result.image.height,
          }),
        );
      }
      if (step === 'rigType' && rigType === 'humanoid' && texture) {
        const { estimatePose } = await import('@/pose/runtime');
        const bitmap = await createImageBitmap(texture.blob);
        try {
          const result = await estimatePose(bitmap);
          if (result.available && meanConfidence(result.keypoints) >= 0.3)
            setJoints(cocoToSkeleton(result.keypoints, texture.image));
        } finally {
          bitmap.close();
        }
      }
      if (step === 'preview' && texture && joints) {
        const character = await saveDrawingCharacter({
          name: name.trim() || t('characterDefault'),
          source,
          drawing: pixels,
          texture: texture.blob,
          textureImage: texture.image,
          mask: texture.mask,
          joints,
          rigType,
        });
        draft.current = false;
        navigate(`/characters/${character.id}`);
        return;
      }
      setStep(nextStep(step, rigType));
    } catch (error) {
      console.warn(error);
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }
  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const c = event.currentTarget;
    const rect = c.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * c.width) / rect.width,
      y: ((event.clientY - rect.top) * c.height) / rect.height,
    };
  }
  function paint(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!painting.current) return;
    const p = point(event);
    if (step === 'mask') setBrushPoint(p);
    if (step === 'crop' && pixels && cropStart.current) {
      const start = cropStart.current;
      setCrop(
        clampRect(
          {
            x: Math.min(start.x, p.x),
            y: Math.min(start.y, p.y),
            width: Math.max(1, Math.abs(p.x - start.x)),
            height: Math.max(1, Math.abs(p.y - start.y)),
          },
          pixels.width,
          pixels.height,
        ),
      );
    }
    if (step === 'mask' && mask && pixels)
      setMask((current) =>
        current
          ? applyBrush(current, pixels.width, pixels.height, {
              ...p,
              radius,
              mode,
            })
          : current,
      );
    if (step === 'joints' && joints && texture)
      setJoints((current) =>
        current
          ? {
              ...current,
              [selected]: {
                x: Math.max(0, Math.min(texture.image.width, p.x)),
                y: Math.max(0, Math.min(texture.image.height, p.y)),
              },
            }
          : current,
      );
  }
  return (
    <main>
      <div className="section-head">
        <button onClick={() => (pixels ? setLeave(true) : navigate('/'))}>
          {t('back')}
        </button>
        <span className="small">{t('newCharacter')}</span>
      </div>
      <ol className="steps" aria-label={t('newCharacter')}>
        {steps
          .filter(
            (s) => s !== 'saved' && (rigType !== 'cutout' || s !== 'joints'),
          )
          .map((s) => (
            <li
              key={s}
              className={
                steps.indexOf(s) <= steps.indexOf(step) ? 'active' : ''
              }
              aria-current={s === step ? 'step' : undefined}
            >
              <span className="sr-only">{t(s)}</span>
            </li>
          ))}
      </ol>
      <h1>{t(step)}</h1>
      {step === 'mask' && <p className="small">{t('brushKeyboard')}</p>}
      {step === 'joints' && joints && texture && (
        <ul className="small" aria-label={t('jointWarnings')}>
          {jointWarnings(
            joints,
            texture.mask,
            texture.image.width,
            texture.image.height,
          ).map((warning) => (
            <li key={`${warning.joint}-${warning.reason}`}>
              {t(`joint_${warning.joint}`)}:{' '}
              {t(`jointWarning_${warning.reason}`)}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {step === 'capture' ? (
        <div className="empty paper">
          <h2>{t('photoHint')}</h2>
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                void openCamera();
              }}
            >
              {t('photo')}
            </button>
            <button disabled={busy} onClick={() => picker.current?.click()}>
              {t('choosePhoto')}
            </button>
          </div>
          <input
            className="file-input"
            ref={picker}
            data-testid="drawing-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              void acquire(event.target.files?.[0], 'file');
            }}
          />
          <input
            className="file-input"
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              void acquire(event.target.files?.[0], 'camera');
            }}
          />
        </div>
      ) : step === 'rigType' ? (
        <div className="type-options">
          {(['humanoid', 'cutout'] as const).map((type) => (
            <button
              key={type}
              aria-pressed={rigType === type}
              onClick={() => {
                setRigType(type);
                setTypeChosen(true);
              }}
            >
              {t(type)}
            </button>
          ))}
        </div>
      ) : (
        <div className="wizard-layout">
          <div className="canvas-wrap" ref={zoomHost}>
            {step === 'preview' && texture && joints ? (
              <Preview texture={texture} joints={joints} rigType={rigType} />
            ) : (
              <canvas
                ref={canvas}
                aria-label={t(step)}
                role="img"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (step === 'mask' && mask && pixels) {
                    const delta = event.shiftKey ? 10 : 1;
                    if (event.key.startsWith('Arrow')) {
                      event.preventDefault();
                      setBrushPoint((current) => ({
                        x: Math.max(
                          0,
                          Math.min(
                            pixels.width - 1,
                            current.x +
                              (event.key === 'ArrowRight'
                                ? delta
                                : event.key === 'ArrowLeft'
                                  ? -delta
                                  : 0),
                          ),
                        ),
                        y: Math.max(
                          0,
                          Math.min(
                            pixels.height - 1,
                            current.y +
                              (event.key === 'ArrowDown'
                                ? delta
                                : event.key === 'ArrowUp'
                                  ? -delta
                                  : 0),
                          ),
                        ),
                      }));
                    }
                    if (event.key === ' ' || event.key === 'Enter') {
                      event.preventDefault();
                      history.current.push(mask);
                      setMask(
                        applyBrush(mask, pixels.width, pixels.height, {
                          ...brushPoint,
                          radius,
                          mode,
                        }),
                      );
                    }
                  }
                  if (
                    step === 'joints' &&
                    joints &&
                    texture &&
                    [
                      'ArrowLeft',
                      'ArrowRight',
                      'ArrowUp',
                      'ArrowDown',
                    ].includes(event.key)
                  ) {
                    event.preventDefault();
                    const axis =
                      event.key === 'ArrowLeft' || event.key === 'ArrowRight'
                        ? 'x'
                        : 'y';
                    const delta =
                      (event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                        ? -1
                        : 1) * (event.shiftKey ? 10 : 1);
                    setJoints((current) =>
                      current
                        ? {
                            ...current,
                            [selected]: {
                              ...current[selected],
                              [axis]: Math.max(
                                0,
                                Math.min(
                                  axis === 'x'
                                    ? texture.image.width
                                    : texture.image.height,
                                  current[selected][axis] + delta,
                                ),
                              ),
                            },
                          }
                        : current,
                    );
                  }
                }}
                onPointerDown={(event) => {
                  painting.current = true;
                  if (step === 'crop') cropStart.current = point(event);
                  event.currentTarget.setPointerCapture(event.pointerId);
                  if (step === 'mask' && mask) history.current.push(mask);
                  if (step === 'joints' && joints) {
                    const p = point(event);
                    const nearest = (Object.keys(joints) as JointName[]).sort(
                      (a, b) =>
                        Math.hypot(joints[a].x - p.x, joints[a].y - p.y) -
                        Math.hypot(joints[b].x - p.x, joints[b].y - p.y),
                    )[0];
                    if (nearest) setSelected(nearest);
                  } else paint(event);
                }}
                onPointerMove={paint}
                onPointerUp={() => {
                  painting.current = false;
                }}
                onPointerCancel={() => {
                  painting.current = false;
                }}
              />
            )}
          </div>
          <aside className="controls">
            {step !== 'preview' && (
              <label>
                {t('zoom')}
                <input
                  type="range"
                  min=".5"
                  max="3"
                  step=".1"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </label>
            )}
            {step === 'crop' && (
              <>
                <button
                  onClick={() => setRotation((value) => (value + 90) % 360)}
                >
                  {t('rotate')}
                </button>
                <label>
                  {t('fineRotate')}
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    value={fine}
                    onChange={(event) => setFine(Number(event.target.value))}
                  />
                </label>
                {(['x', 'y', 'width', 'height'] as const).map((key) => (
                  <label key={key}>
                    {t(
                      {
                        x: 'cropX',
                        y: 'cropY',
                        width: 'cropWidth',
                        height: 'cropHeight',
                      }[key],
                    )}
                    <input
                      type="number"
                      min={key === 'width' || key === 'height' ? 1 : 0}
                      max={
                        key === 'x' || key === 'width'
                          ? pixels?.width
                          : pixels?.height
                      }
                      value={crop[key]}
                      onChange={(event) =>
                        setCrop((current) => ({
                          ...current,
                          [key]: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </>
            )}
            {step === 'mask' && (
              <>
                <div className="actions">
                  <button
                    aria-pressed={mode === 'add'}
                    onClick={() => setMode('add')}
                  >
                    {t('brushAdd')}
                  </button>
                  <button
                    aria-pressed={mode === 'erase'}
                    onClick={() => setMode('erase')}
                  >
                    {t('brushErase')}
                  </button>
                </div>
                <label>
                  {t('brushSize')}
                  <input
                    type="range"
                    min="3"
                    max="80"
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                  />
                </label>
                <div className="actions">
                  <button
                    onClick={() => mask && setMask(history.current.undo(mask))}
                  >
                    {t('undo')}
                  </button>
                  <button
                    onClick={() => mask && setMask(history.current.redo(mask))}
                  >
                    {t('redo')}
                  </button>
                </div>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (pixels) {
                      setBusy(true);
                      void runAuto(pixels)
                        .catch(() => setError(t('error')))
                        .finally(() => setBusy(false));
                    }
                  }}
                >
                  {t('autoMask')}
                </button>
              </>
            )}
            {step === 'joints' && joints && (
              <>
                <p>{t('jointHint')}</p>
                <label>
                  {t('joints')}
                  <select
                    value={selected}
                    onChange={(event) =>
                      setSelected(event.target.value as JointName)
                    }
                  >
                    {(Object.keys(joints) as JointName[]).map((key) => (
                      <option key={key} value={key}>
                        {t(`joint_${key}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="pick-grid">
                  {(['x', 'y'] as const).flatMap((axis) =>
                    [-1, 1].map((direction) => (
                      <button
                        key={`${axis}${direction}`}
                        aria-label={`${t(axis === 'x' ? 'cropX' : 'cropY')} ${direction}`}
                        onClick={() =>
                          setJoints((current) =>
                            current
                              ? {
                                  ...current,
                                  [selected]: {
                                    ...current[selected],
                                    [axis]: Math.max(
                                      0,
                                      Math.min(
                                        axis === 'x'
                                          ? (texture?.image.width ?? 0)
                                          : (texture?.image.height ?? 0),
                                        current[selected][axis] + direction * 3,
                                      ),
                                    ),
                                  },
                                }
                              : current,
                          )
                        }
                      >
                        {axis === 'x'
                          ? direction < 0
                            ? '←'
                            : '→'
                          : direction < 0
                            ? '↑'
                            : '↓'}
                      </button>
                    )),
                  )}
                </div>
              </>
            )}
            {step === 'preview' && (
              <label>
                {t('name')}
                <input
                  maxLength={50}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
          </aside>
        </div>
      )}
      {step !== 'capture' && (
        <div className="toolbar">
          <button
            disabled={busy}
            onClick={() => setStep(previousStep(step, rigType))}
          >
            {t('back')}
          </button>
          <button
            className="primary"
            disabled={busy || (step === 'rigType' && !typeChosen)}
            onClick={() => {
              void forward();
            }}
          >
            {busy ? t('loading') : step === 'preview' ? t('save') : t('next')}
          </button>
        </div>
      )}
      {stream && (
        <Camera
          stream={stream}
          onClose={closeCamera}
          onCapture={(file) => {
            closeCamera();
            void acquire(file, 'camera');
          }}
        />
      )}
      {(leave || blocker.state === 'blocked') && (
        <Dialog
          title={t('leaveTitle')}
          onClose={() => {
            setLeave(false);
            if (blocker.state === 'blocked') blocker.reset();
          }}
          onConfirm={() => {
            draft.current = false;
            if (blocker.state === 'blocked') blocker.proceed();
            else navigate('/');
          }}
          confirmLabel={t('close')}
        >
          <p>{t('leaveBody')}</p>
        </Dialog>
      )}
    </main>
  );
}
