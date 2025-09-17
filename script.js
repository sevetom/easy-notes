// Configure PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Elements
const input = document.getElementById("file-input");
const loadNotesBtn = document.getElementById("load-notes-btn");
const saveNotesBtn = document.getElementById("save-notes-btn");
const loadNotesInput = document.getElementById("load-notes-input");
const closeBtn = document.getElementById("close-btn");

// PDF elements
const pdfViewer = document.getElementById("pdf-viewer");
const pdfCanvas = document.getElementById("pdf-canvas");
const textLayer = document.getElementById("text-layer");
const pdfPlaceholder = document.getElementById("pdf-placeholder");
const pdfInfo = document.getElementById("pdf-info");
const pdfName = document.getElementById("pdf-name");
const pdfPages = document.getElementById("pdf-pages");

// Navigation elements
const prevPageBtn = document.getElementById("prev-page-btn");
const nextPageBtn = document.getElementById("next-page-btn");
const pageInfo = document.getElementById("page-info");
const zoomInBtn = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const zoomInfo = document.getElementById("zoom-info");

// Notes elements
const notePreview = document.getElementById("note-preview");
const noteTextarea = document.getElementById("note-textarea");
const currentPageNotesSpan = document.getElementById("current-page-notes");
const syncIcon = document.getElementById("sync-icon");

// Application state
let selectedFile = "new_notes";
let currentPage = 1;
let totalPages = 1;
let notes = {}; // Object to store notes for each page
let isEditingNote = false;
let pdfDocument = null;
let currentZoom = 1.0;

// Panning state
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panOffsetX = 0;
let panOffsetY = 0;

// Initialize the application
function initializeApp() {
  loadCurrentPageNote();
  showSyncStatus(true);
  updatePageInfo();
  updateNavigationButtons();
  setupPanning();
  
  // Show placeholder initially
  pdfPlaceholder.style.display = 'flex';
  pdfViewer.style.display = 'none';
}

// Show sync status
function showSyncStatus(synced) {
  if (synced) {
    syncIcon.className = 'fas fa-sync-alt text-success';
    syncIcon.title = 'PDF and notes are synchronized';
  } else {
    syncIcon.className = 'fas fa-exclamation-triangle text-warning';
    syncIcon.title = 'Synchronization in progress...';
  }
}

// Show save confirmation
function showSaveConfirmation() {
  const originalIcon = syncIcon.className;
  const originalTitle = syncIcon.title;
  
  syncIcon.className = 'fas fa-check text-success';
  syncIcon.title = 'Notes saved!';
  
  setTimeout(() => {
    syncIcon.className = originalIcon;
    syncIcon.title = originalTitle;
  }, 1500);
}

// PDF file handling with PDF.js
input.addEventListener("change", async function () {
  const file = input.files[0];
  
  // Check if there are unsaved notes before opening a new PDF
  if (file && file.type === "application/pdf" && Object.keys(notes).length > 0) {
    const confirmOpen = confirm("You have unsaved notes. Opening a new PDF will clear all current notes. Are you sure you want to continue?");
    if (!confirmOpen) {
      // Reset the file input if user cancels
      input.value = '';
      return;
    }
  }
  
  selectedFile = file ? file.name.replace(/\.pdf$/i, "") : "new_notes";
  
  if (file && file.type === "application/pdf") {
    // Clear all existing notes when opening a new PDF
    clearAllNotes();
    await loadPDF(file);
  }
});

// Load PDF using PDF.js with text layer
async function loadPDF(file) {
  try {
    showSyncStatus(false);
    
    const arrayBuffer = await file.arrayBuffer();
    pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;
    totalPages = pdfDocument.numPages;
    
    // Update UI
    pdfName.textContent = file.name;
    pdfPages.textContent = totalPages;
    if (pdfInfo) pdfInfo.style.display = 'block';
    
    // Show PDF viewer and hide placeholder
    pdfPlaceholder.style.display = 'none';
    pdfViewer.style.display = 'block';
    
    // Render first page
    currentPage = 1;
    await renderPage(currentPage);
    
    updatePageInfo();
    updateNavigationButtons();
    loadCurrentPageNote();
    
    showSyncStatus(true);
    
  } catch (error) {
    alert('Error loading PDF: ' + error.message);
  }
}

// Render PDF page with text layer
async function renderPage(pageNum) {
  const page = await pdfDocument.getPage(pageNum);
  const scale = currentZoom;
  const viewport = page.getViewport({ scale: scale });
  
  // Setup canvas
  const canvas = pdfCanvas;
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  // Setup text layer with scale factor CSS variable
  textLayer.style.width = viewport.width + 'px';
  textLayer.style.height = viewport.height + 'px';
  textLayer.style.setProperty('--scale-factor', scale);
  textLayer.innerHTML = '';
  
  // Render PDF page
  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };
  await page.render(renderContext).promise;
  
  // Render text layer for text selection
  const textContent = await page.getTextContent();
  pdfjsLib.renderTextLayer({
    textContentSource: textContent,
    container: textLayer,
    viewport: viewport,
    textDivs: []
  });
  
  // Apply current pan offset
  updatePanTransform();
}

// Update pan transform
function updatePanTransform() {
  const container = document.getElementById('pdf-canvas-container');
  container.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px)`;
}

// Setup panning event listeners
function setupPanning() {
  const viewer = pdfViewer;
  
  viewer.addEventListener('mousedown', (e) => {
    if (e.button === 0 && currentZoom > 1.0) { // Left mouse button and zoomed in
      isPanning = true;
      panStartX = e.clientX - panOffsetX;
      panStartY = e.clientY - panOffsetY;
      viewer.classList.add('panning');
      e.preventDefault();
    }
  });
  
  viewer.addEventListener('mousemove', (e) => {
    if (isPanning) {
      panOffsetX = e.clientX - panStartX;
      panOffsetY = e.clientY - panStartY;
      updatePanTransform();
      e.preventDefault();
    }
  });
  
  viewer.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      viewer.classList.remove('panning');
    }
  });
  
  viewer.addEventListener('mouseleave', () => {
    if (isPanning) {
      isPanning = false;
      viewer.classList.remove('panning');
    }
  });
}

// Update page info
function updatePageInfo() {
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  zoomInfo.textContent = `${Math.round(currentZoom * 100)}%`;
}

// Update navigation buttons
function updateNavigationButtons() {
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

// Navigation functions
async function goToPreviousPage() {
  if (currentPage > 1) {
    saveCurrentNote();
    currentPage--;
    await renderPage(currentPage);
    updatePageInfo();
    updateNavigationButtons();
    loadCurrentPageNote();
  }
}

async function goToNextPage() {
  if (currentPage < totalPages) {
    saveCurrentNote();
    currentPage++;
    await renderPage(currentPage);
    updatePageInfo();
    updateNavigationButtons();
    loadCurrentPageNote();
  }
}

// Zoom functions
async function zoomIn() {
  currentZoom = Math.min(currentZoom * 1.2, 3.0);
  await renderPage(currentPage);
  updatePageInfo();
}

async function zoomOut() {
  currentZoom = Math.max(currentZoom / 1.2, 0.5);
  // Reset pan when zooming out to 100% or less
  if (currentZoom <= 1.0) {
    panOffsetX = 0;
    panOffsetY = 0;
  }
  await renderPage(currentPage);
  updatePageInfo();
}

async function zoomReset() {
  currentZoom = 1.0;
  panOffsetX = 0;
  panOffsetY = 0;
  await renderPage(currentPage);
  updatePageInfo();
}

// Event listeners for PDF navigation
prevPageBtn.addEventListener('click', goToPreviousPage);
nextPageBtn.addEventListener('click', goToNextPage);
zoomInBtn.addEventListener('click', zoomIn);
zoomOutBtn.addEventListener('click', zoomOut);
zoomInfo.addEventListener('click', zoomReset);

// Notes management
function clearAllNotes() {
  notes = {}; // Clear all notes
  
  // Clear the current display
  noteTextarea.value = "";
  updateNotePreview("");
  
  // Exit edit mode if active
  if (isEditingNote) {
    exitEditMode();
  }
}

function saveCurrentNote() {
  // Always save the current content of the textarea
  const currentContent = noteTextarea.value || "";
  const previousContent = notes[currentPage] || "";
  
  // Only update if content has actually changed
  if (currentContent !== previousContent) {
    notes[currentPage] = currentContent;
  }
}

function loadCurrentPageNote(autoFocus = false) {
  const noteContent = notes[currentPage] || "";
  
  // Set textarea content
  noteTextarea.value = noteContent;
  
  // Update preview based on content
  updateNotePreview(noteContent);
  
  // Exit edit mode if we're in it, then auto-focus if requested
  if (isEditingNote) {
    exitEditMode();
  }
  
  // Auto-focus for keyboard navigation
  if (autoFocus) {
    setTimeout(() => {
      enterEditMode();
    }, 100);
  }
  
  // Update current page indicator
  currentPageNotesSpan.textContent = currentPage;
}

// Helper function to update note preview
function updateNotePreview(content) {
  if (content.trim() === "") {
    notePreview.innerHTML = `<em>Click here to start taking notes for page ${currentPage}...</em>`;
  } else {
    notePreview.innerHTML = marked.parse(content);
  }
}

function enterEditMode() {
  isEditingNote = true;
  notePreview.classList.add("d-none");
  noteTextarea.classList.remove("d-none");
  noteTextarea.focus();
  
  // Position cursor at the end of existing text
  const length = noteTextarea.value.length;
  noteTextarea.setSelectionRange(length, length);
}

function exitEditMode() {
  saveCurrentNote();
  isEditingNote = false;
  noteTextarea.classList.add("d-none");
  notePreview.classList.remove("d-none");
  updateNotePreview(noteTextarea.value);
}

// Manual page navigation for notes
async function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  
  saveCurrentNote();
  currentPage = page;
  await renderPage(currentPage);
  updatePageInfo();
  updateNavigationButtons();
  loadCurrentPageNote();
}

// Event listeners for notes
notePreview.addEventListener("click", enterEditMode);

noteTextarea.addEventListener("blur", () => {
  exitEditMode();
});

// Auto-save while typing
let saveTimeout;
noteTextarea.addEventListener("input", () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveCurrentNote();
  }, 1000);
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Zoom controls with Ctrl++, Ctrl+-, and Ctrl+0
  if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
    e.preventDefault();
    zoomIn();
    return;
  }
  
  if (e.ctrlKey && e.key === '-') {
    e.preventDefault();
    zoomOut();
    return;
  }
  
  if (e.ctrlKey && e.key === '0') {
    e.preventDefault();
    zoomReset();
    return;
  }
  
  // Save with Ctrl+S
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveCurrentNote();
    showSaveConfirmation();
    return;
  }
  
  // Exit edit mode with Escape
  if (e.key === "Escape" && isEditingNote) {
    e.preventDefault();
    exitEditMode();
    return;
  }
  
  // Enter edit mode with Enter (when not editing)
  if (e.key === "Enter" && !isEditingNote) {
    e.preventDefault();
    enterEditMode();
    return;
  }
  
  // Page navigation with arrow keys (when not editing)
  if (!isEditingNote) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToPage(currentPage - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goToPage(currentPage + 1);
    }
  }
  
  // Page navigation with Ctrl+Arrow (even when editing)
  if (e.ctrlKey) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToPage(currentPage - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goToPage(currentPage + 1);
    }
  }
});

// Load notes functionality
loadNotesInput.addEventListener("change", () => {
  const file = loadNotesInput.files[0];
  if (file && file.name.endsWith('.ezn')) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const loadedNotes = JSON.parse(e.target.result);
        notes = loadedNotes;
        loadCurrentPageNote();
        alert("Notes loaded successfully!");
      } catch (error) {
        alert("Error loading notes: " + error.message);
      }
    };
    reader.readAsText(file);
  }
});

loadNotesBtn.addEventListener("click", () => {
  loadNotesInput.click();
});

// Save notes functionality
saveNotesBtn.addEventListener("click", () => {
  saveCurrentNote();
  
  const notesData = JSON.stringify(notes, null, 2);
  const blob = new Blob([notesData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = selectedFile + ".ezn";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showSaveConfirmation();
});

// Close notes functionality
closeBtn.addEventListener("click", () => {
  if (Object.keys(notes).length > 0) {
    const confirmClose = confirm("You have unsaved notes. Are you sure you want to close?");
    if (!confirmClose) return;
  }
  
  // Reset state
  selectedFile = "new_notes";
  notes = {};
  currentPage = 1;
  totalPages = 1;
  currentZoom = 1.0;
  
  // Clean up PDF document
  if (pdfDocument) {
    pdfDocument = null;
  }
  
  // Hide PDF and show placeholder
  pdfViewer.style.display = 'none';
  pdfPlaceholder.style.display = 'block';
  pdfInfo.style.display = 'none';
  
  // Reset file input
  input.value = '';
  
  // Clear notes display
  clearAllNotes();
  
  // Update page indicator
  currentPageNotesSpan.textContent = currentPage;
});

// Auto-save on page visibility change
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && isEditingNote) {
    saveCurrentNote();
  }
});

// Initialize app when page loads
document.addEventListener("DOMContentLoaded", function() {
  // Check if marked library is loaded
  if (typeof marked === 'undefined') {
    console.error('Marked library not loaded');
    return;
  }
  
  // Initialize the app
  initializeApp();
});