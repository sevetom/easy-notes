const input = document.getElementById("file-input");
const iframe = document.getElementById("pdf-frame");
const addNotesBtn = document.getElementById("add-notes-btn");
const notesCountInput = document.getElementById("notes-count");
const loadNotesBtn = document.getElementById("load-notes-btn");
const saveNotesBtn = document.getElementById("save-notes-btn");
const notesContainer = document.getElementById("notes-container");
const loadNotesInput = document.getElementById("load-notes-input");

let selectedFile = "new_notes";

input.addEventListener("change", function () {
  const file = input.files[0];
  selectedFile = file ? file.name.replace(/\.pdf$/i, "") : "";
  if (file && file.type === "application/pdf") {
    const fileURL = URL.createObjectURL(file);
    iframe.src = fileURL;
  }
});

function createTextAreas(count, existingNotes = []) {
  notesContainer.innerHTML = "";

  for (let i = 1; i <= count; i++) {
    const wrapper = document.createElement("div");

    const label = document.createElement("div");
    label.classList.add("fw-bold", "text-primary", "mb-1");
    label.textContent = `Pagina ${i}`;

    const textarea = document.createElement("textarea");
    textarea.classList.add("form-control");

    if (existingNotes[i - 1]) {
      textarea.value = existingNotes[i - 1];
    }

    wrapper.appendChild(label);
    wrapper.appendChild(textarea);
    notesContainer.appendChild(wrapper);
  }
}

addNotesBtn.addEventListener("click", () => {
  const count = parseInt(notesCountInput.value);
  if (!count || count < 1) {
    alert("Insert a valid number of notes.");
    return;
  }
  notesCountInput.value = 1;
  createTextAreas(count);
});

loadNotesBtn.addEventListener("click", () => {
  loadNotesInput.click();
});

loadNotesInput.addEventListener("change", () => {
  const file = loadNotesInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.notes)) {
        createTextAreas(data.notes.length, data.notes);
      }
    } catch (err) {
      alert("Error loading notes file: " + err.message);
    }
  };
  reader.readAsText(file);
});

saveNotesBtn.addEventListener("click", () => {
  const textareas = notesContainer.querySelectorAll("textarea");
  const notesArray = Array.from(textareas).map((ta) => ta.value);

  const data = {
    notes: notesArray,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = selectedFile + ".pdz";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

const closeBtn = document.getElementById("close-btn");

closeBtn.addEventListener("click", () => {
  iframe.src = "";
  selectedFile = "new_notes";
  notesContainer.innerHTML = "";
});
