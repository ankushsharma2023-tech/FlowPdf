const toolModal = document.getElementById("toolModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");
const statusBar = document.getElementById("statusBar");

function setStatus(msg) {
  statusBar.textContent = msg;
}

function openModal(title, bodyHTML) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  toolModal.classList.remove("hidden");
}

function closeModal() {
  toolModal.classList.add("hidden");
}

modalClose.addEventListener("click", closeModal);
toolModal.addEventListener("click", e => {
  if (e.target === toolModal) closeModal();
});

/* FILTERS */
document.querySelectorAll(".filter-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    const filter = pill.dataset.filter;
    document.querySelectorAll(".tool-card").forEach(card => {
      const cat = card.dataset.category;
      if (filter === "all" || cat === filter) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  });
});

/* TOOL CLICK HANDLING */

document.querySelectorAll(".tool-card").forEach(card => {
  card.addEventListener("click", () => {
    const tool = card.dataset.tool;
    handleToolClick(tool);
  });
});

function handleToolClick(tool) {
  if (tool === "merge-pdf") {
    openMergeTool();
  } else if (tool === "jpg-pdf") {
    openJpgPdfTool();
  } else if (tool === "split-pdf") {
    openSplitToolPlaceholder();
  } else if (tool === "compress-pdf") {
    openCompressTool();
  } else if (tool === "workflow-builder") {
    openWorkflowBuilder();
  } else {
    openPlaceholder(tool);
  }
}

/* QUICK FILE INPUT (just for status) */

document.getElementById("quickFileInput").addEventListener("change", e => {
  if (!e.target.files.length) return;
  setStatus(`Selected ${e.target.files.length} file(s). Now choose a tool.`);
});

/* DOWNLOAD HELPER */

function downloadBytes(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* MERGE PDF – LIVE USING pdf-lib */

function openMergeTool() {
  openModal(
    "Merge PDF",
    `
      <p>Select multiple PDF files to merge in order.</p>
      <input id="mergeInput" type="file" accept="application/pdf" multiple />
      <button class="primary" id="mergeBtn">Merge PDFs</button>
      <p class="note">All processing happens in your browser. No files are uploaded to any server.</p>
    `
  );

  const input = document.getElementById("mergeInput");
  const btn = document.getElementById("mergeBtn");

  btn.addEventListener("click", async () => {
    if (!input.files.length) {
      alert("Please choose at least 2 PDF files.");
      return;
    }
    if (input.files.length < 2) {
      alert("Select 2 or more PDFs to merge.");
      return;
    }
    setStatus("Merging PDFs in browser…");
    try {
      const { PDFDocument } = window.PDFLib;
      const mergedPdf = await PDFDocument.create();

      for (const file of input.files) {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(p => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      downloadBytes(mergedBytes, "merged.pdf", "application/pdf");
      setStatus("Merged PDF downloaded as merged.pdf");
    } catch (err) {
      console.error(err);
      alert("Error while merging PDFs.");
      setStatus("Error while merging PDFs.");
    }
  });
}

/* JPG ⇄ PDF TOOL – LIVE USING jsPDF */

function openJpgPdfTool() {
  openModal(
    "JPG ⇄ PDF",
    `
      <p>Convert one or more JPG/PNG images into a single PDF.</p>
      <input id="imgPdfInput" type="file" accept="image/*" multiple />
      <div class="modal-row">
        <label for="imgMargin">Margin (mm)</label>
        <input id="imgMargin" type="number" value="10" min="0" />
      </div>
      <button class="primary" id="imgPdfBtn">Convert to PDF</button>
      <p class="note">Images are added page by page. Orientation is automatically adjusted.</p>
    `
  );

  const input = document.getElementById("imgPdfInput");
  const btn = document.getElementById("imgPdfBtn");
  const marginInput = document.getElementById("imgMargin");

  btn.addEventListener("click", async () => {
    if (!input.files.length) {
      alert("Please select at least one image.");
      return;
    }
    setStatus("Building PDF from images…");
    try {
      const { jsPDF } = window.jspdf;
      const margin = Number(marginInput.value) || 10;
      const firstImage = input.files[0];

      const imageInfos = await Promise.all(
        [...input.files].map(file => readImage(file))
      );

      const doc = new jsPDF({
        orientation: imageInfos[0].width >= imageInfos[0].height ? "landscape" : "portrait",
        unit: "mm",
        format: "a4"
      });

      for (let i = 0; i < imageInfos.length; i++) {
        const info = imageInfos[i];
        if (i > 0) doc.addPage(info.width >= info.height ? "landscape" : "portrait");

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const maxWidth = pageWidth - 2 * margin;
        const maxHeight = pageHeight - 2 * margin;

        let w = info.width;
        let h = info.height;
        const ratio = Math.min(maxWidth / w, maxHeight / h);
        w *= ratio;
        h *= ratio;

        const x = (pageWidth - w) / 2;
        const y = (pageHeight - h) / 2;

        doc.addImage(info.dataURL, info.type, x, y, w, h);
      }

      const pdfBytes = doc.output("arraybuffer");
      downloadBytes(pdfBytes, "images-to-pdf.pdf", "application/pdf");
      setStatus("PDF downloaded as images-to-pdf.pdf");
    } catch (err) {
      console.error(err);
      alert("Error while converting images.");
      setStatus("Error while converting images.");
    }
  });
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
          dataURL: e.target.result,
          type: file.type.includes("png") ? "PNG" : "JPEG"
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* COMPRESS – BASIC (just resave using pdf-lib, real compression needs backend) */

function openCompressTool() {
  openModal(
    "Compress PDF",
    `
      <p>Basic compression: re-saves the PDF which can sometimes reduce size. Strong compression needs a backend.</p>
      <input id="compressInput" type="file" accept="application/pdf" />
      <button class="primary" id="compressBtn">Compress</button>
      <p class="note">For real heavy compression (images re-encoding, downscaling), integrate a server-side tool like Ghostscript or an online API.</p>
    `
  );

  const input = document.getElementById("compressInput");
  const btn = document.getElementById("compressBtn");

  btn.addEventListener("click", async () => {
    if (!input.files.length) {
      alert("Choose a PDF first.");
      return;
    }
    setStatus("Processing PDF…");
    try {
      const { PDFDocument } = window.PDFLib;
      const bytes = await input.files[0].arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const newBytes = await pdf.save({ useObjectStreams: true });
      downloadBytes(newBytes, "compressed.pdf", "application/pdf");
      setStatus("Compressed PDF downloaded as compressed.pdf");
    } catch (e) {
      console.error(e);
      alert("Error while compressing.");
      setStatus("Error while compressing.");
    }
  });
}

/* SPLIT – PLACEHOLDER MESSAGE */

function openSplitToolPlaceholder() {
  openModal(
    "Split PDF (UI placeholder)",
    `
      <p>You can implement splitting using <code>pdf-lib</code> similar to merge:
      load the PDF, then create a new PDF per page or page range.</p>
      <p class="note">Implementation idea:
        <br/>• Ask user for page ranges (e.g. 1-3,4,5-7)
        <br/>• Use <code>copyPages</code> to build separate docs
        <br/>• Download each as its own file
      </p>
    `
  );
}

/* WORKFLOW BUILDER – BASIC LOCALSTORAGE UI */

function openWorkflowBuilder() {
  const saved = JSON.parse(localStorage.getItem("flowpdf_workflows") || "[]");
  openModal(
    "Create Workflow",
    `
      <p>Create custom workflows like “Scan → OCR → Compress → Protect” and save them.</p>
      <div class="modal-row">
        <label for="wfName">Workflow name</label>
        <input id="wfName" type="text" placeholder="My DSA Notes Workflow" />
      </div>
      <div style="margin-top:8px;font-size:0.8rem;color:#9ca3af;">
        Choose steps (they are conceptual; you can later wire them to real calls):
      </div>
      <div id="wfSteps" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin-top:6px;font-size:0.8rem;">
        ${[
          "Scan to PDF",
          "OCR PDF",
          "Compress PDF",
          "Protect PDF",
          "Sign PDF",
          "Organize PDF",
          "JPG to PDF",
          "PDF to Word",
          "Word to PDF"
        ]
          .map(
            step => `
          <label style="background:rgba(15,23,42,0.9);border:1px solid rgba(148,163,184,0.4);border-radius:999px;padding:4px 8px;display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" value="${step}" style="accent-color:#6366f1;"/>
            <span>${step}</span>
          </label>`
          )
          .join("")}
      </div>
      <button class="primary" id="wfSaveBtn">Save workflow</button>
      <p class="note">Saved locally in this browser only.</p>
      <hr style="border-color:rgba(55,65,81,0.6);margin:10px 0;" />
      <p><strong>Saved workflows</strong></p>
      <ul id="wfList" style="list-style:none;padding-left:0;margin-top:4px;font-size:0.8rem;">
        ${
          saved.length
            ? saved
                .map(
                  wf => `<li style="margin-bottom:4px;">• <strong>${wf.name}</strong> – ${wf.steps.join(
                    " → "
                  )}</li>`
                )
                .join("")
            : "<li>No workflows yet.</li>"
        }
      </ul>
    `
  );

  const saveBtn = document.getElementById("wfSaveBtn");
  saveBtn.addEventListener("click", () => {
    const nameInput = document.getElementById("wfName");
    const name = nameInput.value.trim();
    if (!name) {
      alert("Give your workflow a name.");
      return;
    }
    const checkboxes = [...document.querySelectorAll("#wfSteps input[type=checkbox]:checked")];
    if (!checkboxes.length) {
      alert("Select at least one step.");
      return;
    }
    const steps = checkboxes.map(c => c.value);
    const listEl = document.getElementById("wfList");

    const current = JSON.parse(localStorage.getItem("flowpdf_workflows") || "[]");
    current.push({ name, steps });
    localStorage.setItem("flowpdf_workflows", JSON.stringify(current));

    const li = document.createElement("li");
    li.style.marginBottom = "4px";
    li.innerHTML = `• <strong>${name}</strong> – ${steps.join(" → ")}`;
    if (listEl.textContent.includes("No workflows yet")) listEl.innerHTML = "";
    listEl.appendChild(li);
    setStatus(`Workflow “${name}” saved locally.`);
  });
}

/* PLACEHOLDER FOR ADVANCED TOOLS (WORD/PPT/EXCEL/OCR, ETC.) */

function openPlaceholder(tool) {
  const map = {
    "pdf-to-word": "PDF ⇄ Word",
    "pdf-to-ppt": "PDF ⇄ PowerPoint",
    "pdf-to-excel": "PDF ⇄ Excel",
    "html-pdf": "HTML ⇄ PDF",
    "pdf-pdfa": "PDF → PDF/A",
    "ocr-pdf": "OCR PDF",
    "edit-pdf": "Edit PDF",
    "rotate-pdf": "Rotate PDF",
    "page-numbers": "Page numbers",
    "watermark": "Watermark",
    "crop-pdf": "Crop PDF",
    "compare-pdf": "Compare PDF",
    "redact-pdf": "Redact PDF",
    "sign-pdf": "Sign PDF",
    "unlock-pdf": "Unlock PDF",
    "protect-pdf": "Protect PDF",
    "organize-pdf": "Organize PDF"
  };
  const title = map[tool] || "Tool";

  openModal(
    title,
    `
      <p>This is a placeholder panel for <strong>${title}</strong>.</p>
      <p class="note">
        To make this fully functional (with images inside Word, PowerPoint and Excel preserved):
        <br/>• Add an <code>&lt;input type="file"&gt;</code> for the original file
        <br/>• Call a backend API (Node / Python / Java) that uses tools like LibreOffice, MS Office, or paid services
        <br/>• Return a converted PDF (or DOCX/PPTX/XLSX) and download it in the browser
      </p>
      <p class="note">
        Good rule: <strong>Client side</strong> for pure PDFs and images (merge, split, rotate, simple edit).<br/>
        <strong>Server side or external APIs</strong> for Office formats, OCR, repair, compare and redact – these need heavy engines.
      </p>
    `
  );
}
