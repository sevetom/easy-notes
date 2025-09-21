// Configure PDF.js
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  
  // Set additional PDF.js options to prevent errors
  pdfjsLib.GlobalWorkerOptions.isEvalSupported = false;
} else {
  console.error('PDF.js library not loaded properly');
}

// Global error handler
window.addEventListener('error', function(event) {
  console.error('Global error:', event.error);
  console.error('Error at line:', event.lineno, 'column:', event.colno);
  console.error('File:', event.filename);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
});

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
const pageInput = document.getElementById("page-input");
const totalPagesSpan = document.getElementById("total-pages");
const zoomInBtn = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const zoomInfo = document.getElementById("zoom-info");
const highlightBtn = document.getElementById("highlight-btn");
const eraserBtn = document.getElementById("eraser-btn");
const savePdfBtn = document.getElementById("save-pdf-btn");

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
let currentZoom = 1.0;
let minZoom = 0.5; // Minimum zoom level
let maxZoom = 3.0; // Maximum zoom level
let originalPdfBytes = null; // Store original PDF for modifications
let originalPdfArrayBuffer = null; // Store original ArrayBuffer as backup

// Panning state
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panOffsetX = 0;
let panOffsetY = 0;

// Highlighting state
let isHighlightMode = false;
let isEraserMode = false;
let highlights = {}; // Store highlights by page
let isSelecting = false;

// Initialize the application
function initializeApp() {
  updatePageInfo();
  updateNavigationButtons();
  updateZoomIndicator();
  updateZoomButtons();
  updateCanvasCursor();
  loadCurrentPageNote();
  showSyncStatus(true);
  
  // Show placeholder initially
  pdfPlaceholder.style.display = 'flex';
  pdfViewer.style.display = 'none';
  
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
      Ctrl++ Ctrl+- Ctrl+Wheel: Zoom controls<br>
      Click on highlighted text to remove it <br>
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
    
    // Store both ArrayBuffer and Uint8Array as backup
    originalPdfArrayBuffer = arrayBuffer.slice(); // Create a copy
    originalPdfBytes = new Uint8Array(arrayBuffer); // Save original PDF bytes
    
    pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;
    totalPages = pdfDocument.numPages;
    
    // Reset highlights for new PDF
    highlights = {};
    
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
  if (!pdfDocument || renderingPage) return;
  
  try {
    renderingPage = true;
    showSyncStatus(false);
    
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
    
    // Restore highlights for this page
    setTimeout(() => restoreHighlights(), 100);
    
    showSyncStatus(true);
  } catch (error) {
    console.error('Error rendering page:', error);
  } finally {
    renderingPage = false;
  }
}

// Update pan transform
function updatePanTransform() {
  const container = document.getElementById('pdf-canvas-container');
  if (container) {
    container.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px)`;
  }
}

// Setup panning event listeners
function setupPanning() {
  const viewer = pdfViewer;
  
  viewer.addEventListener('mousedown', (e) => {
    if (e.button === 0 && currentZoom > 1.0 && !isHighlightMode && !isEraserMode) { // Left mouse button and zoomed in
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
      updateCanvasCursor();
    }
  });
  
  viewer.addEventListener('mouseleave', () => {
    if (isPanning) {
      isPanning = false;
      viewer.classList.remove('panning');
      updateCanvasCursor();
    }
  });
}

// Highlighting functions
function toggleHighlightMode() {
  isHighlightMode = !isHighlightMode;
  isEraserMode = false; // Disable eraser when highlighting
  
  highlightBtn.classList.toggle('active', isHighlightMode);
  if (eraserBtn) eraserBtn.classList.remove('active');
  
  if (isHighlightMode) {
    // Disable panning when highlighting
    pdfViewer.style.cursor = 'text';
    setupTextSelection();
  } else {
    // Re-enable panning
    pdfViewer.style.cursor = currentZoom > 1.0 ? 'grab' : 'default';
    cleanupTextSelection();
  }
}

function toggleEraserMode() {
  isEraserMode = !isEraserMode;
  isHighlightMode = false; // Disable highlighting when erasing
  
  if (eraserBtn) eraserBtn.classList.toggle('active', isEraserMode);
  highlightBtn.classList.remove('active');
  
  if (isEraserMode) {
    // Disable panning when erasing
    pdfViewer.style.cursor = 'crosshair';
    cleanupTextSelection();
  } else {
    // Re-enable panning
    pdfViewer.style.cursor = currentZoom > 1.0 ? 'grab' : 'default';
  }
}

function setupTextSelection() {
  textLayer.addEventListener('mousedown', startTextSelection);
  textLayer.addEventListener('mouseup', endTextSelection);
}

function cleanupTextSelection() {
  textLayer.removeEventListener('mousedown', startTextSelection);
  textLayer.removeEventListener('mouseup', endTextSelection);
}

function startTextSelection(e) {
  if (!isHighlightMode) return;
  isSelecting = true;
}

function endTextSelection(e) {
  if (!isHighlightMode || !isSelecting) return;
  
  const selection = window.getSelection();
  if (selection.rangeCount > 0 && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    createHighlight(range);
    selection.removeAllRanges();
  }
  isSelecting = false;
}

function createHighlight(range) {
  const pageHighlights = highlights[currentPage] || [];
  
  // Create highlight element
  const highlight = document.createElement('div');
  highlight.className = 'user-highlight';
  highlight.style.position = 'absolute';
  
  const rect = range.getBoundingClientRect();
  const textLayerRect = textLayer.getBoundingClientRect();
  
  highlight.style.left = (rect.left - textLayerRect.left) + 'px';
  highlight.style.top = (rect.top - textLayerRect.top) + 'px';
  highlight.style.width = rect.width + 'px';
  highlight.style.height = rect.height + 'px';
  
  // Add click to remove functionality
  highlight.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isHighlightMode || isEraserMode) {
      removeHighlight(highlight);
    }
  });
  
  textLayer.appendChild(highlight);
  
  // Store highlight data
  const highlightData = {
    element: highlight,
    text: range.toString(),
    rect: {
      left: rect.left - textLayerRect.left,
      top: rect.top - textLayerRect.top,
      width: rect.width,
      height: rect.height
    }
  };
  
  pageHighlights.push(highlightData);
  highlights[currentPage] = pageHighlights;
}

function removeHighlight(highlightElement) {
  const pageHighlights = highlights[currentPage] || [];
  const index = pageHighlights.findIndex(h => h.element === highlightElement);
  if (index > -1) {
    pageHighlights.splice(index, 1);
    highlightElement.remove();
  }
}

function restoreHighlights() {
  const pageHighlights = highlights[currentPage] || [];
  pageHighlights.forEach(highlightData => {
    const highlight = document.createElement('div');
    highlight.className = 'user-highlight';
    highlight.style.position = 'absolute';
    highlight.style.left = highlightData.rect.left + 'px';
    highlight.style.top = highlightData.rect.top + 'px';
    highlight.style.width = highlightData.rect.width + 'px';
    highlight.style.height = highlightData.rect.height + 'px';
    
    highlight.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isHighlightMode || isEraserMode) {
        removeHighlight(highlight);
      }
    });
    
    textLayer.appendChild(highlight);
    highlightData.element = highlight;
  });
}

async function savePdfWithHighlights() {
  // Use ArrayBuffer as backup if Uint8Array is empty
  let pdfData = originalPdfBytes;
  if (!originalPdfBytes || originalPdfBytes.length === 0) {
    if (originalPdfArrayBuffer && originalPdfArrayBuffer.byteLength > 0) {
      pdfData = new Uint8Array(originalPdfArrayBuffer);
    } else {
      alert('No PDF loaded or PDF data is empty');
      return;
    }
  }

  try {
    // Check if there are any highlights to embed
    const hasHighlights = Object.keys(highlights).length > 0;
    
    if (hasHighlights) {
      // Use PDF-lib to embed highlights
      const pdfDoc = await PDFLib.PDFDocument.load(pdfData);
      
      // Get all pages
      const pages = pdfDoc.getPages();
      
      // Add highlights to each page
      for (const [pageNum, pageHighlights] of Object.entries(highlights)) {
        const pageIndex = parseInt(pageNum) - 1; // Convert to 0-based index
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          const { width, height } = page.getSize();
          
          // Add highlight annotations for each highlight on this page
          for (const highlight of pageHighlights) {
            // Get the rectangle coordinates (already relative to text layer)
            const rect = highlight.rect;
            
            // Convert from text layer coordinates to PDF coordinates
            // PDF coordinates are from bottom-left, our coordinates are from top-left
            const pdfX = rect.left;
            const pdfY = height - rect.top - rect.height;
            
            // Create a highlight annotation
            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: rect.width,
              height: rect.height,
              color: PDFLib.rgb(1, 1, 0), // Yellow color
              opacity: 0.4,
            });
          }
        }
      }
      
      // Save the modified PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = (selectedFile || 'document') + '_highlighted.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('PDF saved with highlights embedded!');
    } else {
      // No highlights, just save the original PDF
      const blob = new Blob([pdfData], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = (selectedFile || 'document') + '_copy.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('PDF saved! (No highlights to embed)');
    }
  } catch (error) {
    console.error('Error saving PDF:', error);
    alert('Error saving PDF: ' + error.message);
  }
}

// Update page info
function updatePageInfo() {
  pageInput.value = currentPage;
  pageInput.max = totalPages;
  totalPagesSpan.textContent = totalPages;
  zoomInfo.textContent = `${Math.round(currentZoom * 100)}%`;
  currentPageNotesSpan.textContent = currentPage;
}

// Update navigation buttons
function updateNavigationButtons() {
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

// Zoom functions
function updateZoomIndicator() {
  zoomInfo.textContent = Math.round(currentZoom * 100) + '%';
}

function updateZoomButtons() {
  // Update button states if they exist
  if (zoomOutBtn) zoomOutBtn.disabled = currentZoom <= minZoom;
  if (zoomInBtn) zoomInBtn.disabled = currentZoom >= maxZoom;
}

async function zoomTo(newZoom, centerX = null, centerY = null) {
  if (!pdfDocument) return;
  
  const oldZoom = currentZoom;
  currentZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
  
  // If zoom position is specified, adjust pan offset to zoom towards that point
  if (centerX !== null && centerY !== null) {
    const canvas = pdfCanvas;
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // Calculate relative position within the container
    const relativeX = centerX - rect.left;
    const relativeY = centerY - rect.top;
    
    // Calculate how much the zoom center should move
    const zoomFactor = currentZoom / oldZoom;
    const deltaX = (relativeX - container.clientWidth / 2) * (zoomFactor - 1);
    const deltaY = (relativeY - container.clientHeight / 2) * (zoomFactor - 1);
    
    // Adjust pan offset
    panOffsetX -= deltaX;
    panOffsetY -= deltaY;
  } else if (currentZoom === 1.0) {
    // Reset pan when zoom is reset
    panOffsetX = 0;
    panOffsetY = 0;
  }
  
  updateZoomIndicator();
  updateZoomButtons();
  updateCanvasCursor();
  await renderPage(currentPage);
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

async function zoomReset() {
  await zoomTo(1.0);
}

// Update cursor based on zoom level
function updateCanvasCursor() {
  if (isHighlightMode) {
    pdfViewer.style.cursor = 'text';
  } else if (isEraserMode) {
    pdfViewer.style.cursor = 'crosshair';
  } else if (currentZoom > 1.0) {
    pdfViewer.style.cursor = 'grab';
  } else {
    pdfViewer.style.cursor = 'default';
  }
}

// Manual page navigation for notes
async function goToPage(page, autoFocus = false) {
  if (page < 1 || page > totalPages || page === currentPage) return;
  
  const previousPage = currentPage;
  
  // Double-check: always save current note content before switching
  saveCurrentNote();
  
  // // Additional safety: verify the save worked correctly
  // const savedContent = notes[previousPage] || "";
  // const textareaContent = noteTextarea.value || "";
  // if (savedContent !== textareaContent) {
  //   console.warn(`⚠️  Save verification failed! Re-saving page ${previousPage}`);
  //   notes[previousPage] = textareaContent;
  // }
  
  currentPage = page;
  
  // Render the new page if PDF is loaded
  if (pdfDocument) {
    await renderPage(currentPage);
  }
  
  // Update UI
  updatePageInfo();
  updateNavigationButtons();
  loadCurrentPageNote(autoFocus);
}

// Navigation functions
async function goToPreviousPage() {
  if (currentPage > 1) {
    await goToPage(currentPage - 1, false); // No auto-focus for button clicks
  }
}

async function goToNextPage() {
  if (currentPage < totalPages) {
    await goToPage(currentPage + 1, false); // No auto-focus for button clicks
  }
}

// Event listeners for PDF navigation
prevPageBtn.addEventListener('click', goToPreviousPage);
nextPageBtn.addEventListener('click', goToNextPage);
zoomInBtn.addEventListener('click', zoomIn);
zoomOutBtn.addEventListener('click', zoomOut);
zoomInfo.addEventListener('click', zoomReset);
highlightBtn.addEventListener('click', toggleHighlightMode);
if (eraserBtn) eraserBtn.addEventListener('click', toggleEraserMode);
savePdfBtn.addEventListener('click', savePdfWithHighlights);

// Mouse wheel zoom on PDF viewer
pdfViewer.addEventListener("wheel", async (e) => {
  if (e.ctrlKey || e.metaKey) { // Ctrl+wheel or Cmd+wheel for zoom
    e.preventDefault();
    
    if (e.deltaY < 0) { // Scroll up = zoom in
      await zoomIn(e.clientX, e.clientY);
    } else { // Scroll down = zoom out
      await zoomOut(e.clientX, e.clientY);
    }
  }
});

// Page input event listeners
pageInput.addEventListener('change', (e) => {
  const newPage = parseInt(e.target.value);
  if (newPage >= 1 && newPage <= totalPages) {
    goToPage(newPage);
  } else {
    // Reset to current page if invalid
    pageInput.value = currentPage;
  }
});

pageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const newPage = parseInt(e.target.value);
    if (newPage >= 1 && newPage <= totalPages) {
      goToPage(newPage);
    } else {
      // Reset to current page if invalid
      pageInput.value = currentPage;
    }
    // Remove focus after pressing Enter
    e.target.blur();
  }
});

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
  
  // Set textarea content directly without verification timeout
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

// Event listeners for notes
notePreview.addEventListener("click", enterEditMode);

noteTextarea.addEventListener("blur", () => {
  exitEditMode();
});

// Auto-save while typing (debounced)
let saveTimeout;
noteTextarea.addEventListener("input", () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (isEditingNote) {
      saveCurrentNote();
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
    return;
  }

  // Prevent refresh even while editing
  if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
    e.preventDefault();
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
    e.stopPropagation(); // Prevent event from bubbling up to document handler
    
    let targetPage = currentPage;
    if (e.key === 'ArrowLeft' && currentPage > 1) {
      targetPage = currentPage - 1;
    } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
      targetPage = currentPage + 1;
    }
    
    if (targetPage !== currentPage) {
      // Save current note before switching pages
      saveCurrentNote();
      
      const previousPage = currentPage;
      currentPage = targetPage;
      
      // Render the new page if PDF is loaded
      if (pdfDocument) {
        await renderPage(currentPage);
      }
      
      // Update UI
      updatePageInfo();
      updateNavigationButtons();
      
      // Load the note for the new page without exiting edit mode
      const noteContent = notes[currentPage] || "";
      noteTextarea.value = noteContent;
      updateNotePreview(noteContent);
      
      // Keep focus on textarea to maintain editing mode
      noteTextarea.focus();
    }
    return;
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", async (e) => {
  // Prevent page refresh with F5 or Ctrl+R globally
  if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
    e.preventDefault();
    return;
  }
  
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
  
  // Zoom controls with Ctrl++, Ctrl+-, and Ctrl+0
  if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
    e.preventDefault();
    await zoomIn();
    return;
  }
  
  if (e.ctrlKey && e.key === '-') {
    e.preventDefault();
    await zoomOut();
    return;
  }
  
  // Escape key to exit edit mode
  if (e.key === 'Escape' && isEditingNote) {
    e.preventDefault();
    exitEditMode();
    return;
  }
  
  // Enter key to start editing (when not in edit mode)
  if (e.key === 'Enter' && !isEditingNote && !e.target.matches('input, textarea, button')) {
    e.preventDefault();
    enterEditMode();
    return;
  }
  
  // Ctrl+S to save notes manually
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveCurrentNote();
    showSaveConfirmation();
    return;
  }
  
  // Page navigation with Ctrl+Arrow (even when editing - handled above in textarea listener)
  if (e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    
    let targetPage = currentPage;
    if (e.key === 'ArrowLeft' && currentPage > 1) {
      targetPage = currentPage - 1;
    } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
      targetPage = currentPage + 1;
    }
    
    if (targetPage !== currentPage) {
      await goToPage(targetPage, isEditingNote); // Auto-focus if editing
    }
    return;
  }
});

// Load notes functionality
loadNotesInput.addEventListener("change", async () => {
  const file = loadNotesInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      // Clear current notes first to avoid conflicts
      notes = {};
      
      // Handle both old format (direct notes object) and new format (with metadata)
      if (data.notes && typeof data.notes === 'object') {
        // Deep copy to avoid reference issues
        notes = JSON.parse(JSON.stringify(data.notes));
        
        // Update total pages if loaded from notes (only if no PDF is loaded)
        if (data.totalPages && !pdfDocument) {
          totalPages = data.totalPages;
        }
        
        // Restore last page if available
        if (data.lastPage && data.lastPage <= totalPages) {
          await goToPage(data.lastPage);
        } else {
          // Just reload current page to ensure sync
          loadCurrentPageNote();
        }
      } else {
        // Old format - data is directly the notes object
        notes = JSON.parse(JSON.stringify(data));
        loadCurrentPageNote();
      }
      
      // Update current view
      updatePageInfo();
      updateNavigationButtons();
      
      console.log(`📂 Loaded notes file with ${Object.keys(notes).length} pages of notes`);
      
    } catch (err) {
      alert("Error loading notes file: " + err.message);
    }
  };
  reader.readAsText(file);
});

loadNotesBtn.addEventListener("click", () => {
  loadNotesInput.click();
});

// Save notes functionality
saveNotesBtn.addEventListener("click", () => {
  // Save current note before saving file
  saveCurrentNote();
  
  const data = {
    notes: notes,
    totalPages: totalPages,
    lastPage: currentPage,
    savedAt: new Date().toISOString()
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
  
  showSaveConfirmation();
});

// Close notes functionality
closeBtn.addEventListener("click", () => {
  if (Object.keys(notes).length > 0) {
    const confirmClose = confirm("You have unsaved notes. Are you sure you want to close?");
    if (!confirmClose) return;
  }
  
  // Reset PDF state
  if (pdfDocument) {
    pdfDocument = null;
  }
  
  // Reset state
  selectedFile = "new_notes";
  notes = {};
  currentPage = 1;
  totalPages = 1;
  currentZoom = 1.0;
  panOffsetX = 0; // Reset pan
  panOffsetY = 0;
  isHighlightMode = false;
  isEraserMode = false;
  highlights = {};
  
  // Reset UI
  highlightBtn.classList.remove('active');
  if (eraserBtn) eraserBtn.classList.remove('active');
  
  // Hide PDF and show placeholder
  pdfViewer.style.display = 'none';
  pdfPlaceholder.style.display = 'flex';
  if (pdfInfo) pdfInfo.style.display = 'none';
  
  // Reset file input
  input.value = '';
  
  // Clear notes display
  clearAllNotes();
  
  // Update indicators
  updatePageInfo();
  updateNavigationButtons();
  updateZoomIndicator();
  updateZoomButtons();
  updateCanvasCursor();
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
});

// Save notes when page becomes hidden (user switches tabs, etc.)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    saveCurrentNote();
  }
});

// Initialize app when page loads
document.addEventListener("DOMContentLoaded", function() {
  // Check if all required libraries are loaded
  if (typeof pdfjsLib === 'undefined') {
    console.error('PDF.js library not loaded');
    return;
  }
  if (typeof marked === 'undefined') {
    console.error('Marked library not loaded');
    return;
  }
  
  // Initialize the app
  initializeApp();
  
  // Setup panning after initialization
  setupPanning();
});