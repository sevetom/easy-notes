// Configure PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Elements
const input = document.getElementById("file-input");
const loadNotesBtn = document.getElementById("load-notes-btn");
const saveNotesBtn = document.getElementById("save-notes-btn");
const loadNotesInput = document.getElementById("load-notes-input");
const closeBtn = document.getElementById("close-btn");

// PDF elements
const pdfCanvas = document.getElementById("pdf-canvas");
const pdfLoading = document.getElementById("pdf-loading");
const pdfPlaceholder = document.getElementById("pdf-placeholder");
const pdfInfo = document.getElementById("pdf-info");
const pdfName = document.getElementById("pdf-name");
const pdfPages = document.getElementById("pdf-pages");

// Navigation elements
const prevPageBtn = document.getElementById("prev-page-btn");
const nextPageBtn = document.getElementById("next-page-btn");
const pageInput = document.getElementById("page-input");
const totalPagesDisplay = document.getElementById("total-pages-display");

// Zoom elements
const zoomInBtn = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const zoomResetBtn = document.getElementById("zoom-reset-btn");
const zoomIndicator = document.getElementById("zoom-indicator");

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
let renderingPage = false;
let currentZoom = 1.0; // Current zoom level
let minZoom = 0.5; // Minimum zoom level
let maxZoom = 3.0; // Maximum zoom level

// Panning state
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panOffsetX = 0;
let panOffsetY = 0;

// Initialize the application
function initializeApp() {
  updatePageIndicator();
  updateNavigationButtons();
  updateZoomIndicator();
  updateZoomButtons();
  updateCanvasCursor();
  loadCurrentPageNote();
  showSyncStatus(true);
  
  // Show placeholder initially
  pdfPlaceholder.style.display = 'block';
  pdfCanvas.style.display = 'none';
  
  // Add keyboard shortcuts help
  const shortcutsDiv = document.createElement('div');
  shortcutsDiv.className = 'shortcuts-help collapsed'; // Start collapsed
  shortcutsDiv.innerHTML = `
    <div class="shortcuts-help-header">
      <strong>Keyboard Shortcuts</strong>
      <button class="shortcuts-toggle" title="Show shortcuts">
        <i class="fas fa-chevron-up"></i>
      </button>
    </div>
    <div class="shortcuts-help-content">
      ← → Navigate pages (auto-focus)<br>
      <strong>While editing:</strong><br>
      Ctrl+← → Navigate while typing<br>
      Alt+← → Alternative navigation<br>
      Enter: Start editing | Esc: Exit<br>
      Ctrl+S: Save notes
    </div>
  `;
  document.body.appendChild(shortcutsDiv);
  
  // Add toggle functionality for shortcuts help
  const toggleBtn = shortcutsDiv.querySelector('.shortcuts-toggle');
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    shortcutsDiv.classList.toggle('collapsed');
    const isCollapsed = shortcutsDiv.classList.contains('collapsed');
    const icon = toggleBtn.querySelector('i');
    icon.className = isCollapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    toggleBtn.title = isCollapsed ? 'Show shortcuts' : 'Hide shortcuts';
  });
  
  // Also allow clicking on header to toggle
  const header = shortcutsDiv.querySelector('.shortcuts-help-header');
  header.addEventListener('click', () => {
    toggleBtn.click();
  });
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
  selectedFile = file ? file.name.replace(/\.pdf$/i, "") : "new_notes";
  
  if (file && file.type === "application/pdf") {
    await loadPDF(file);
  }
});

// Load PDF using PDF.js
async function loadPDF(file) {
  try {
    showSyncStatus(false);
    pdfLoading.style.display = 'block';
    pdfPlaceholder.style.display = 'none';
    
    const arrayBuffer = await file.arrayBuffer();
    pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;
    
    // Update total pages automatically
    totalPages = pdfDocument.numPages;
    currentPage = 1;
    
    // Update UI
    pdfName.textContent = file.name;
    pdfPages.textContent = totalPages;
    pdfInfo.style.display = 'block';
    
    // Render first page
    await renderPage(currentPage);
    
    // Update navigation
    updatePageIndicator();
    updateNavigationButtons();
    loadCurrentPageNote();
    
    pdfLoading.style.display = 'none';
    pdfCanvas.style.display = 'block';
    showSyncStatus(true);
    
    console.log(`PDF loaded: ${totalPages} pages`);
  } catch (error) {
    console.error('Error loading PDF:', error);
    alert('Error loading PDF: ' + error.message);
    pdfLoading.style.display = 'none';
    pdfPlaceholder.style.display = 'block';
  }
}

// Render a specific page
async function renderPage(pageNumber) {
  if (!pdfDocument || renderingPage) return;
  
  try {
    renderingPage = true;
    showSyncStatus(false);
    
    const page = await pdfDocument.getPage(pageNumber);
    const canvas = pdfCanvas;
    const context = canvas.getContext('2d');
    
    // Calculate scale to fit container with proper aspect ratio
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth - 40; // Account for padding
    const containerHeight = container.clientHeight - 40; // Account for navigation overlay at top (now smaller)
    const viewport = page.getViewport({ scale: 1 });
    
    // Calculate base scale to fit both width and height
    const scaleX = containerWidth / viewport.width;
    const scaleY = containerHeight / viewport.height;
    const baseScale = Math.min(scaleX, scaleY, 2.0); // Max base scale of 2.0 for better quality
    
    // Apply current zoom to the base scale
    const finalScale = baseScale * currentZoom;
    
    const scaledViewport = page.getViewport({ scale: finalScale });
    
    // Set canvas dimensions
    canvas.height = scaledViewport.height;
    canvas.width = scaledViewport.width;
    
    // Update canvas position based on pan offset
    canvas.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px)`;
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Render page
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport
    };
    
    await page.render(renderContext).promise;
    
    showSyncStatus(true);
  } catch (error) {
    console.error('Error rendering page:', error);
  } finally {
    renderingPage = false;
  }
}

// Page navigation functions
async function goToPage(page, autoFocus = false) {
  if (page < 1 || page > totalPages || page === currentPage) return;
  
  const previousPage = currentPage;
  
  // Double-check: always save current note content before switching
  saveCurrentNote();
  
  // Additional safety: verify the save worked correctly
  const savedContent = notes[previousPage] || "";
  const textareaContent = noteTextarea.value || "";
  if (savedContent !== textareaContent) {
    console.warn(`⚠️  Save verification failed! Re-saving page ${previousPage}`);
    notes[previousPage] = textareaContent;
  }
  
  console.log(`🔄 Switching from page ${previousPage} to page ${page}${autoFocus ? ' (with auto-focus)' : ''}`);
  
  currentPage = page;
  
  // Render the new page if PDF is loaded
  if (pdfDocument) {
    await renderPage(currentPage);
  }
  
  // Update UI
  updatePageIndicator();
  updateNavigationButtons();
  loadCurrentPageNote(autoFocus);
  
  console.log(`✅ Successfully navigated to page ${currentPage}`);
}

function updatePageIndicator() {
  pageInput.value = currentPage;
  pageInput.max = totalPages;
  totalPagesDisplay.textContent = totalPages;
  currentPageNotesSpan.textContent = currentPage;
}

function updateNavigationButtons() {
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

// Zoom functions
function updateZoomIndicator() {
  zoomIndicator.textContent = Math.round(currentZoom * 100) + '%';
}

function updateZoomButtons() {
  zoomOutBtn.disabled = currentZoom <= minZoom;
  zoomInBtn.disabled = currentZoom >= maxZoom;
}

async function zoomIn(centerX = null, centerY = null) {
  if (currentZoom < maxZoom) {
    await zoomTo(Math.min(currentZoom + 0.25, maxZoom), centerX, centerY);
  }
}

async function zoomOut(centerX = null, centerY = null) {
  if (currentZoom > minZoom) {
    await zoomTo(Math.max(currentZoom - 0.25, minZoom), centerX, centerY);
  }
}

async function zoomTo(newZoom, centerX = null, centerY = null) {
  if (!pdfDocument) return;
  
  const oldZoom = currentZoom;
  currentZoom = newZoom;
  
  // If zoom position is specified, adjust pan offset to zoom towards that point
  if (centerX !== null && centerY !== null) {
    const canvas = pdfCanvas;
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // Calculate relative position within the container
    const relativeX = centerX - rect.left;
    const relativeY = centerY - rect.top;
    
    // Calculate how much the zoom center should move
    const zoomFactor = newZoom / oldZoom;
    const deltaX = (relativeX - container.clientWidth / 2) * (zoomFactor - 1);
    const deltaY = (relativeY - container.clientHeight / 2) * (zoomFactor - 1);
    
    // Adjust pan offset
    panOffsetX -= deltaX;
    panOffsetY -= deltaY;
  } else if (newZoom === 1.0) {
    // Reset pan when zoom is reset
    panOffsetX = 0;
    panOffsetY = 0;
  }
  
  updateZoomIndicator();
  updateZoomButtons();
  updateCanvasCursor();
  await renderPage(currentPage);
  
  console.log(`Zoomed to ${Math.round(currentZoom * 100)}%`);
}

async function resetZoom() {
  await zoomTo(1.0);
  console.log('Zoom reset to 100%');
}

// Remove the old updatePDFPage function as it's no longer needed
// PDF rendering is now handled directly by renderPage()

// Notes management
function saveCurrentNote() {
  // Always save the current content of the textarea
  const currentContent = noteTextarea.value || "";
  const previousContent = notes[currentPage] || "";
  
  // Only update if content has actually changed
  if (currentContent !== previousContent) {
    notes[currentPage] = currentContent;
    console.log(`✅ Updated note for page ${currentPage}:`, currentContent.substring(0, 50) + (currentContent.length > 50 ? "..." : ""));
  } else {
    console.log(`📝 Note for page ${currentPage} unchanged`);
  }
}

function loadCurrentPageNote(autoFocus = false) {
  const noteContent = notes[currentPage] || "";
  
  // Debug log
  console.log(`📖 Loading note for page ${currentPage}:`, noteContent.substring(0, 50) + (noteContent.length > 50 ? "..." : ""));
  
  // Set textarea content
  noteTextarea.value = noteContent;
  
  // Verification: ensure textarea content matches what we loaded
  setTimeout(() => {
    if (noteTextarea.value !== noteContent) {
      console.warn(`⚠️  Load verification failed! Re-setting page ${currentPage} content`);
      noteTextarea.value = noteContent;
    }
  }, 50);
  
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
    }, 100); // Small delay to ensure DOM is ready
  }
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
  
  console.log("Entered edit mode for page", currentPage);
}

function exitEditMode() {
  isEditingNote = false;
  saveCurrentNote();
  
  // Get the updated content after saving
  const noteContent = notes[currentPage] || "";
  updateNotePreview(noteContent);
  
  notePreview.classList.remove("d-none");
  noteTextarea.classList.add("d-none");
}

// Event listeners for navigation
prevPageBtn.addEventListener("click", async () => {
  if (currentPage > 1) {
    await goToPage(currentPage - 1, false); // No auto-focus for button clicks
  }
});

nextPageBtn.addEventListener("click", async () => {
  if (currentPage < totalPages) {
    await goToPage(currentPage + 1, false); // No auto-focus for button clicks
  }
});

// Page input event listeners
pageInput.addEventListener("change", async (e) => {
  const targetPage = parseInt(e.target.value);
  if (targetPage && targetPage >= 1 && targetPage <= totalPages && targetPage !== currentPage) {
    await goToPage(targetPage, false);
  } else {
    // Revert to current page if invalid input
    pageInput.value = currentPage;
  }
});

pageInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    const targetPage = parseInt(e.target.value);
    if (targetPage && targetPage >= 1 && targetPage <= totalPages && targetPage !== currentPage) {
      await goToPage(targetPage, false);
    } else {
      // Revert to current page if invalid input
      pageInput.value = currentPage;
    }
    e.target.blur(); // Remove focus from input
  }
});

// Zoom event listeners
zoomInBtn.addEventListener("click", zoomIn);
zoomOutBtn.addEventListener("click", zoomOut);
zoomResetBtn.addEventListener("click", resetZoom);

// Mouse wheel zoom on PDF canvas
pdfCanvas.addEventListener("wheel", async (e) => {
  if (e.ctrlKey || e.metaKey) { // Ctrl+wheel or Cmd+wheel for zoom
    e.preventDefault();
    
    if (e.deltaY < 0) { // Scroll up = zoom in
      await zoomIn(e.clientX, e.clientY);
    } else { // Scroll down = zoom out
      await zoomOut(e.clientX, e.clientY);
    }
  }
});

// Mouse panning on PDF canvas
pdfCanvas.addEventListener("mousedown", (e) => {
  if (currentZoom > 1.0 && e.button === 0) { // Left mouse button and zoomed in
    isPanning = true;
    panStartX = e.clientX - panOffsetX;
    panStartY = e.clientY - panOffsetY;
    pdfCanvas.style.cursor = 'grabbing';
    e.preventDefault();
  }
});

document.addEventListener("mousemove", async (e) => {
  if (isPanning) {
    panOffsetX = e.clientX - panStartX;
    panOffsetY = e.clientY - panStartY;
    
    // Apply the transform immediately for smooth panning
    pdfCanvas.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px)`;
  }
});

document.addEventListener("mouseup", () => {
  if (isPanning) {
    isPanning = false;
    pdfCanvas.style.cursor = currentZoom > 1.0 ? 'grab' : 'default';
  }
});

// Update cursor based on zoom level
function updateCanvasCursor() {
  if (currentZoom > 1.0) {
    pdfCanvas.style.cursor = 'grab';
  } else {
    pdfCanvas.style.cursor = 'default';
  }
}

// Remove manual page setting since we auto-detect from PDF
// setPagesBtn functionality is no longer needed as pages are auto-detected from PDF

// Event listeners for notes
notePreview.addEventListener("click", enterEditMode);

noteTextarea.addEventListener("blur", exitEditMode);

// Auto-save while typing (debounced)
let saveTimeout;
noteTextarea.addEventListener("input", () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (isEditingNote) {
      saveCurrentNote();
      console.log("Auto-saved note while typing");
    }
  }, 1000); // Save after 1 second of no typing
});

// Handle keyboard navigation while editing
noteTextarea.addEventListener("keydown", async (e) => {
  // Save with Ctrl+S
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveCurrentNote();
    showSaveConfirmation();
    console.log("Manual save with Ctrl+S in textarea");
    return;
  }
  
  // Allow standard editing shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X)
  if (e.ctrlKey && ['z', 'y', 'a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
    // Let these through without interference
    return;
  }
  
  // Navigate pages while editing with Ctrl+Arrow keys
  if (e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    
    let targetPage = currentPage;
    if (e.key === 'ArrowLeft' && currentPage > 1) {
      targetPage = currentPage - 1;
    } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
      targetPage = currentPage + 1;
    }
    
    if (targetPage !== currentPage) {
      console.log(`Navigating from page ${currentPage} to ${targetPage} while editing`);
      await goToPage(targetPage, true); // Keep auto-focus enabled
    }
    return;
  }
  
  // Alternative navigation with Alt+Arrow keys (for those who prefer Alt)
  if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    
    let targetPage = currentPage;
    if (e.key === 'ArrowLeft' && currentPage > 1) {
      targetPage = currentPage - 1;
    } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
      targetPage = currentPage + 1;
    }
    
    if (targetPage !== currentPage) {
      console.log(`Navigating from page ${currentPage} to ${targetPage} while editing (Alt+Arrow)`);
      await goToPage(targetPage, true); // Keep auto-focus enabled
    }
    return;
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", async (e) => {
  // Only handle shortcuts if not editing a note and not in an input field
  if (!isEditingNote && !e.target.matches('input, textarea')) {
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (currentPage > 1) {
          await goToPage(currentPage - 1, true); // Auto-focus enabled
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (currentPage < totalPages) {
          await goToPage(currentPage + 1, true); // Auto-focus enabled
        }
        break;

    }
  }
  
  // Escape key to exit edit mode
  if (e.key === 'Escape' && isEditingNote) {
    exitEditMode();
  }
  
  // Enter key to start editing (when not in edit mode)
  if (e.key === 'Enter' && !isEditingNote && !e.target.matches('input, textarea, button')) {
    e.preventDefault();
    enterEditMode();
  }
  
  // Ctrl+S to save notes manually
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveCurrentNote();
    console.log("Manual save with Ctrl+S (global)");
    
    // Show a brief save confirmation
    showSaveConfirmation();
  }
});

// File operations
loadNotesBtn.addEventListener("click", () => {
  loadNotesInput.click();
});

loadNotesInput.addEventListener("change", () => {
  const file = loadNotesInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.notes && typeof data.notes === 'object') {
        notes = data.notes;
        
        // Update total pages if loaded from notes (only if no PDF is loaded)
        if (data.totalPages && !pdfDocument) {
          totalPages = data.totalPages;
        }
        
        // Restore last page if available
        if (data.lastPage && data.lastPage <= totalPages) {
          await goToPage(data.lastPage);
        }
        
        // Update current view
        updatePageIndicator();
        updateNavigationButtons();
        loadCurrentPageNote();
        
        alert("Notes loaded successfully!");
      }
    } catch (err) {
      alert("Error loading notes file: " + err.message);
    }
  };
  reader.readAsText(file);
});

saveNotesBtn.addEventListener("click", () => {
  // Save current note before saving file
  saveCurrentNote();
  
  const data = {
    notes: notes,
    totalPages: totalPages,
    lastPage: currentPage
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = selectedFile + ".ezn";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  alert("Notes saved successfully!");
});

closeBtn.addEventListener("click", () => {
  if (Object.keys(notes).length > 0) {
    const confirmClose = confirm("You have unsaved notes. Are you sure you want to close?");
    if (!confirmClose) return;
  }
  
  // Reset PDF state
  if (pdfDocument) {
    pdfDocument = null;
  }
  
  // Reset UI
  selectedFile = "new_notes";
  notes = {};
  currentPage = 1;
  totalPages = 1;
  currentZoom = 1.0; // Reset zoom
  panOffsetX = 0; // Reset pan
  panOffsetY = 0;
  
  // Hide PDF and show placeholder
  pdfCanvas.style.display = 'none';
  pdfPlaceholder.style.display = 'block';
  pdfInfo.style.display = 'none';
  
  // Reset file input
  input.value = '';
  
  updatePageIndicator();
  updateNavigationButtons();
  updateZoomIndicator();
  updateZoomButtons();
  loadCurrentPageNote();
  showSyncStatus(true);
});

// Handle window resize for PDF re-rendering
window.addEventListener('resize', debounce(async () => {
  if (pdfDocument && !renderingPage) {
    await renderPage(currentPage);
  }
}, 300));

// Debounce function to limit resize event frequency
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Save notes before leaving the page
window.addEventListener("beforeunload", (e) => {
  saveCurrentNote();
  console.log("Auto-saved before page unload");
});

// Save notes when page becomes hidden (user switches tabs, etc.)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    saveCurrentNote();
    console.log("Auto-saved on visibility change");
  }
});

// Initialize app when page loads
document.addEventListener("DOMContentLoaded", initializeApp);
