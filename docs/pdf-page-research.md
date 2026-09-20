# PDF page research and Board placement

Open an uploaded PDF from its Library detail page or the Research Topic / Project document views. The page workspace renders the PDF locally with PDF.js, lets you move between pages, shows available text from the current page, and accepts a title and research note. Choose a Board to save and place the page, or save it to the Library first.

Saving creates one PNG media source for the selected page. The source keeps its PDF ID, page number, extracted text, and note. A `derived_from` relationship joins it to the PDF, so both source pages show the association in **Used in**. The original PDF is retained. Board placement uses the existing retry-safe transfer receipt and normal Board autosave. The page card can be moved, resized, annotated, and reopened from the Board.

Private PDF bytes are served only after an owner check, without a public Storage URL. Page PNGs use an owner-prefixed private Storage path. Finalization verifies the owner of the PDF, the PNG signature, size, dimensions, source identity, and page metadata before registering the image. A failed finalization can be retried with the same image ID. No database migration is required.

Limits: PDFs are currently limited to 20 MB by the upload flow; saved page images are limited to 10 MB and rendered at up to 1600 pixels on the long side. Text extraction is best effort and may be empty for scans. The current workspace does not perform OCR or search inside PDFs. A Board must already exist to place a page directly. The server verifies the page image and linked PDF but does not independently compare image pixels against the original PDF.

Validation: lint, the full Node test suite, and the Next.js production build; a rollback-only authenticated database smoke test of page provenance and Board placement. Authenticated browser upload and Board interaction still require a disposable test account or user walkthrough.
