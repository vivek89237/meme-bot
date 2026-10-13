# Approved character references

Recommended reference: `reference-sheet.png`, an AI-edited sheet based on the two user-supplied images. It shows Bubu (white panda) and Dudu (brown bear) at similar heights on white, with no captions or watermark. Image editing can alter small details; review the sheet before using it as your canonical identity source. The older separate PNGs remain available as alternatives.
Use one clean sheet showing both characters, or separate PNG/JPEG/WebP files:

- `white-panda.png`
- `brown-bear.png`

Prefer a plain background, full-body poses, clear faces and no captions, speech bubbles or comic-panel borders. Keep the same canonical files across runs. Each file must be at least 128×128 pixels and at most 5 MB. Up to four files are accepted; all inputs are padded to a 1024×768 reference sheet without cropping or stretching. Two separate files sit side by side; three or four use a two-row grid.

Configure paths relative to the directory where you run npm:

```dotenv
HF_IMAGE_MODE=reference
HF_REFERENCE_MODEL=black-forest-labs/FLUX.1-Kontext-dev
HF_IMAGE_PROVIDER=fal-ai
HF_CHARACTER_REFERENCES=["assets/characters/reference-sheet.png"]
```

For separate files, list both paths instead. The ordinary `HF_IMAGE_MODEL` setting is used only in text mode. Reference generation requires inference credit and access to the chosen image-editing model. Character fidelity is encouraged and reviewed, but is not guaranteed.

For GitHub Actions, commit the approved files or provide them separately during checkout. A local file on your computer is not automatically available to Actions. Configure `HF_IMAGE_MODE`, `HF_REFERENCE_MODEL`, and `HF_CHARACTER_REFERENCES` as Actions Variables (Secrets also work). Never put API tokens into image files or this document.

## Download sources

Downloaded from [amirisback/photo-panda-bear-dudu-bubu](https://github.com/amirisback/photo-panda-bear-dudu-bubu) on 2026-10-07:

- `white-panda.png`: [panda-blink.gif](https://raw.githubusercontent.com/amirisback/photo-panda-bear-dudu-bubu/master/bear-panda/panda-blink.gif), first frame, 240×240.
- `brown-bear.png`: [bear-blink.gif](https://raw.githubusercontent.com/amirisback/photo-panda-bear-dudu-bubu/master/bear-panda/bear-blink.gif), first frame, 584×550.

The original colors, composition and transparent backgrounds are preserved. These are character appearance references; the brown reference does not show a complete lower body. Source attribution does not establish a reuse license.
