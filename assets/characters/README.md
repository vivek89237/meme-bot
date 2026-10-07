# Approved character references

Add your own approved images here; no character pictures are bundled.
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
