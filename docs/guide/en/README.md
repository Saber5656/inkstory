# inkstory guide for parents

inkstory works in a modern browser. Keep the browser tab open while a drawing is being prepared. The first load downloads the app shell and bundled assets; later offline behavior depends on the browser's service-worker cache.

## Make a character

1. From the library, choose **Make a character** and select a camera photo or an image file. Allow camera access only if you want to take the photo in the browser.
2. Use even light, avoid a strong shadow, place the paper on a plain background, and fill the frame with the drawing while leaving a little margin. A dark outline and clear separation from the paper make the mask easier to correct.
3. In **Crop**, move the rectangle over the drawing. Rotate in 90-degree steps when the photo orientation is wrong, then use the fine rotation control if needed. Continue only when the drawing is upright and fully visible.
4. In **Mask**, automatic background removal creates a tinted preview. The brush adds painted areas to the character; erase removes them. Use undo after an accidental stroke, zoom and pan for small gaps, and choose **Re-run automatic mask** when the photo framing was changed. Inspect feet, hair, thin lines, and spaces between limbs before continuing.
5. Select **Humanoid** when the drawing has a person-like body and you want skeletal motions. The 16 pins are a starting point, not a diagnosis. Select **Cutout** for animals, objects, or any drawing where a single cutout with effects is a better fit.
6. For humanoid mode, drag each pin onto the drawing: head/neck, shoulders, elbows, hands, hips, knees, and feet. Use **Reset to template** if the pins become confusing. Pins outside the mask are warnings that you can correct before preview.
7. Preview the motion. Go back to the mask or joints step when an edge or limb bends badly, then save the character.

The pose model is an optional assist. If it is missing, slow, or unavailable, the template and joint editor remain usable; no photo is uploaded to obtain a pose.

## Stage and books

Open a saved character to enter Stage mode. Choose a bundled background and motion, then play the result. For a story, choose **New book**, add pages, select one character and a background, type up to 500 characters of page text, and choose a motion. Set page advance to tap or automatic. In a page's narration control, allow microphone access, record, stop, and listen back before saving. A recording is limited to 60 seconds and 20 MiB; cancel releases the microphone.

Use the player for fullscreen bedtime reading. Keep the device volume and screen brightness at a comfortable level. The MVP does not send story text or audio to a server and has no cloud text-to-speech.

## Back up and move your work

Open **Settings**, select the characters/books to include, and choose **Export**. Save the downloaded `.inkstory` file somewhere you control before clearing browser data or changing devices. To restore it, choose **Import**, inspect the preview, then confirm. Import rejects malformed paths, invalid schemas, oversized archives, and invalid PNG/audio limits.

The current exporter includes character metadata, rig JSON, texture and thumbnail PNGs, book/page JSON, and narration audio. It validates the source drawing before export but does not currently place that original drawing file in the archive. Keep the original photo separately if you need it.

## If something goes wrong

- **Camera or microphone denied:** use the browser's site-permission controls to allow the device, reload, and retry. HTTPS (or localhost during development) is required by browsers. You can choose an existing image and skip narration.
- **Drawing looks empty or has paper left:** improve light and contrast, rerun the mask, then use add/erase at a zoomed view. Cutout mode is a safe fallback for a difficult humanoid.
- **Animation bends strangely:** reset the template, move the pins to the visible joints, and preview again. Very thin or disconnected artwork may need cutout mode.
- **Storage warning or missing work:** use Export immediately. In Settings, request persistent storage and watch the usage indicator. Browser storage can be cleared by the user or evicted under device pressure; a backup is the portable copy.
- **The pose model is unavailable or the network is slow:** continue with template joints and manual pins. The model is not required for character creation.
- **An update prompt appears:** finish or export work, then accept the update and reload. A service-worker update can replace cached app files while IndexedDB remains local.

## Screenshots

Production-build desktop Chromium, 2026-09-08. The bundled sample is original artwork; physical-device checks remain separate.

![Library with a sample character](../../screenshots/library-desktop.png)

![Stage with motion and background controls](../../screenshots/stage-desktop.png)
