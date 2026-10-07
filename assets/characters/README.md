# Approved character references

Bundled references show Bubu (the white panda) and Dudu (the brown bear), matching the requested color assignments. They are static first-frame PNG exports of the source stickers below. You can replace them with your preferred approved images.
Use one clean sheet showing both characters, or separate PNG/JPEG/WebP files:

- `white-panda.png`
- `brown-bear.png`

Prefer a plain background, full-body poses, clear faces and no captions, speech bubbles or comic-panel borders. Keep the same canonical files across runs. Each file must be at least 128×128 pixels and at most 5 MB. Up to four files are accepted; separate files become a side-by-side reference sheet without cropping.

Configure paths relative to the directory where you run npm:

```dotenv
HF_IMAGE_MODE=reference
HF_REFERENCE_MODEL=black-forest-labs/FLUX.1-Kontext-dev
HF_IMAGE_PROVIDER=fal-ai
HF_CHARACTER_REFERENCES=["assets/characters/white-panda.png","assets/characters/brown-bear.png"]
```

For a single existing sheet, list that file instead. The ordinary `HF_IMAGE_MODEL` setting is used only in text mode. Reference generation requires inference credit and access to the chosen image-editing model. Character fidelity is encouraged and reviewed, but is not guaranteed.

For GitHub Actions, commit the approved files or provide them separately during checkout. A local file on your computer is not automatically available to Actions. Configure `HF_IMAGE_MODE`, `HF_REFERENCE_MODEL`, and `HF_CHARACTER_REFERENCES` as Actions Variables (Secrets also work). Never put API tokens into image files or this document.

## Download sources

Downloaded from [amirisback/photo-panda-bear-dudu-bubu](https://github.com/amirisback/photo-panda-bear-dudu-bubu) on 2026-10-07:

- `white-panda.png`: [panda-blink.gif](https://raw.githubusercontent.com/amirisback/photo-panda-bear-dudu-bubu/master/bear-panda/panda-blink.gif), first frame, 240×240.
- `brown-bear.png`: [bear-blink.gif](https://raw.githubusercontent.com/amirisback/photo-panda-bear-dudu-bubu/master/bear-panda/bear-blink.gif), first frame, 584×550.

The original colors, composition and transparent backgrounds are preserved. These are character appearance references; the brown reference does not show a complete lower body. Source attribution does not establish a reuse license.
