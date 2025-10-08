// Configure PDF.js
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  // Set additional PDF.js options to prevent errors
  pdfjsLib.GlobalWorkerOptions.isEvalSupported = false;
} else {
  console.error("PDF.js library not loaded properly");
}

// Global error handler
window.addEventListener("error", function (event) {
  console.error("Global error:", event.error);
  console.error("Error at line:", event.lineno, "column:", event.colno);
  console.error("File:", event.filename);
});

// Handle unhandled promise rejections
window.addEventListener("unhandledrejection", function (event) {
  console.error("Unhandled promise rejection:", event.reason);
});

// DOM Elements
const pdfInput = document.getElementById("pdf-input");
const saveNotesBtn = document.getElementById("save-notes-btn");
const loadNotesInput = document.getElementById("load-notes-input");
const closeBtn = document.getElementById("close-btn");
const filesInput = document.getElementById("files-input");

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
const fitToWidthBtn = document.getElementById("fit-to-width-btn");
const highlightBtn = document.getElementById("highlight-btn");
const savePdfBtn = document.getElementById("save-pdf-btn");

// Notes elements
const notePreview = document.getElementById("note-preview");
const noteTextarea = document.getElementById("note-textarea");
const currentPageNotesSpan = document.getElementById("current-page-notes");
const syncIcon = document.getElementById("sync-icon");

// Search elements
const searchInput = document.getElementById("search-input");
const searchPrevBtn = document.getElementById("search-prev-btn");
const searchNextBtn = document.getElementById("search-next-btn");
const searchCurrentSpan = document.getElementById("search-current");
const searchTotalSpan = document.getElementById("search-total");
const searchResultsInfo = document.getElementById("search-results-info");

// Application state
let selectedFile = "new_notes";
let currentPage = 1;
let totalPages = 100; // Default to 100 virtual pages when no PDF is loaded
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
let highlights = {}; // Store highlights by page
let isSelecting = false;

// Search state
let searchResults = [];
let currentSearchIndex = -1;
let lastSearchTerm = "";
let pdfTextContent = {}; // Store PDF text content by page

// LocalStorage management for auto-backup
const LOCALSTORAGE_KEY = 'easyNotes_recentNotes';

function saveNotesToLocalStorage() {
  try {
    const data = {
      notes: notes,
      totalPages: totalPages,
      lastPage: currentPage,
      selectedFile: selectedFile,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving notes to localStorage:', error);
  }
}

function loadNotesFromLocalStorage() {
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      
      // Only load if there are actually notes to restore
      if (data.notes && Object.keys(data.notes).length > 0) {
        notes = data.notes;
        
        // Restore other state if no PDF is loaded
        if (!pdfDocument) {
          totalPages = data.totalPages || 100;
          currentPage = data.lastPage || 1;
          selectedFile = data.selectedFile || "new_notes";
        }
        
        return true;
      }
    }
  } catch (error) {
    console.error('Error loading notes from localStorage:', error);
  }
  return false;
}

function clearLocalStorageNotes() {
  try {
    localStorage.removeItem(LOCALSTORAGE_KEY);
  } catch (error) {
    console.error('Error clearing localStorage notes:', error);
  }
}

// Initialize the application
function initializeApp() {
  // Try to load notes from localStorage on startup
  const loaded = loadNotesFromLocalStorage();
  
  updatePageInfo();
  updateNavigationButtons();
  updateZoomIndicator();
  updateZoomButtons();
  updateCanvasCursor();
  loadCurrentPageNote();
  showSyncStatus(true);
  
  // Show a subtle indicator if notes were restored
  if (loaded) {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    const data = JSON.parse(stored);
    const savedDate = new Date(data.savedAt);
    const now = new Date();
    const diffMinutes = Math.floor((now - savedDate) / 60000);
    
    let timeStr = '';
    if (diffMinutes < 1) {
      timeStr = 'just now';
    } else if (diffMinutes < 60) {
      timeStr = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      timeStr = `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      timeStr = `${days} day${days > 1 ? 's' : ''} ago`;
    }
    
    console.log(`✓ Restored recent notes (saved ${timeStr})`);
    
    // Show a toast notification
    showToast(`📝 Restored recent notes (saved ${timeStr})`);
  }

  // Show placeholder initially
  pdfPlaceholder.style.display = "flex";
  pdfViewer.style.display = "none";
  
  // Setup shortcuts modal
  setupShortcutsModal();
}

// Setup shortcuts modal functionality
function setupShortcutsModal() {
  const shortcutsBtn = document.getElementById('shortcuts-btn');
  const modal = document.getElementById('shortcutsModal');
  const closeBtn = modal.querySelector('.shortcuts-close-btn');
  const overlay = modal.querySelector('.shortcuts-modal-overlay');
  
  function openModal() {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }
  
  function closeModal() {
    modal.classList.remove('show');
    document.body.style.overflow = ''; // Restore scrolling
  }
  
  // Open modal on button click
  shortcutsBtn.addEventListener('click', openModal);
  
  // Close modal on close button click
  closeBtn.addEventListener('click', closeModal);
  
  // Close modal on overlay click
  overlay.addEventListener('click', closeModal);
  
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeModal();
    }
  });
}

// Show sync status
function showSyncStatus(synced) {
  if (synced) {
    syncIcon.className = "fas fa-sync-alt text-success";
    syncIcon.title = "PDF and notes are synchronized";
  } else {
    syncIcon.className = "fas fa-exclamation-triangle text-warning";
    syncIcon.title = "Synchronization in progress...";
  }
}

// Show toast notification
function showToast(message, duration = 3000) {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast-notification');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Show save confirmation
function showSaveConfirmation() {
  const originalIcon = syncIcon.className;
  const originalTitle = syncIcon.title;

  syncIcon.className = "fas fa-check text-success";
  syncIcon.title = "Notes saved!";

  setTimeout(() => {
    syncIcon.className = originalIcon;
    syncIcon.title = originalTitle;
  }, 1500);
}

// PDF file handling with PDF.js
pdfInput.addEventListener("change", async function () {
  const file = pdfInput.files[0];

  selectedFile = file ? file.name.replace(/\.pdf$/i, "") : "new_notes";

  if (file && file.type === "application/pdf") {
    // Load PDF without clearing notes - keeps notes from previous sessions
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

    // Clear PDF text content cache and search results
    pdfTextContent = {};
    clearSearch();
    // Clear search input field
    if (searchInput) {
      searchInput.value = "";
    }

    // Update UI
    pdfName.textContent = file.name;
    pdfPages.textContent = totalPages;
    if (pdfInfo) pdfInfo.style.display = "block";

    // Show PDF viewer and hide placeholder
    pdfPlaceholder.style.display = "none";
    pdfViewer.style.display = "block";

    // Render first page
    currentPage = 1;
    await renderPage(currentPage);

    updatePageInfo();
    updateNavigationButtons();
    loadCurrentPageNote();

    showSyncStatus(true);
  } catch (error) {
    alert("Error loading PDF: " + error.message);
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
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Setup text layer with scale factor CSS variable
    textLayer.style.width = viewport.width + "px";
    textLayer.style.height = viewport.height + "px";
    textLayer.style.setProperty("--scale-factor", scale);
    textLayer.innerHTML = "";

    // Render PDF page
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    await page.render(renderContext).promise;

    // Render text layer for text selection
    const textContent = await page.getTextContent();
    pdfjsLib.renderTextLayer({
      textContentSource: textContent,
      container: textLayer,
      viewport: viewport,
      textDivs: [],
    });

    // Apply current pan offset
    updatePanTransform();

    // Restore highlights for this page
    setTimeout(() => {
      restoreHighlights();
      // Refresh search highlights if there's an active search
      if (searchResults.length > 0 && currentSearchIndex >= 0) {
        const currentResult = searchResults[currentSearchIndex];
        if (currentResult && currentResult.page === pageNum) {
          highlightSearchResult(currentResult);
        }
      }
    }, 100);

    showSyncStatus(true);
  } catch (error) {
    console.error("Error rendering page:", error);
  } finally {
    renderingPage = false;
  }
}

// Update pan transform
function updatePanTransform() {
  const container = document.getElementById("pdf-canvas-container");
  if (container) {
    container.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px)`;
  }
}

// Setup panning event listeners
function setupPanning() {
  const viewer = pdfViewer;

  viewer.addEventListener("mousedown", (e) => {
    if (
      e.button === 0 &&
      currentZoom > 1.0 &&
      !isHighlightMode &&
      (e.altKey || e.target === pdfCanvas) // Only pan with Alt key or when clicking on canvas (not text layer)
    ) {
      // Left mouse button and zoomed in
      isPanning = true;
      panStartX = e.clientX - panOffsetX;
      panStartY = e.clientY - panOffsetY;
      viewer.classList.add("panning");
      e.preventDefault();
    }
  });

  viewer.addEventListener("mousemove", (e) => {
    if (isPanning) {
      panOffsetX = e.clientX - panStartX;
      panOffsetY = e.clientY - panStartY;
      updatePanTransform();
      e.preventDefault();
    }
  });

  viewer.addEventListener("mouseup", () => {
    if (isPanning) {
      isPanning = false;
      viewer.classList.remove("panning");
      updateCanvasCursor();
    }
  });

  viewer.addEventListener("mouseleave", () => {
    if (isPanning) {
      isPanning = false;
      viewer.classList.remove("panning");
      updateCanvasCursor();
    }
  });
}

// Highlighting functions
function toggleHighlightMode() {
  isHighlightMode = !isHighlightMode;

  highlightBtn.classList.toggle("active", isHighlightMode);

  if (isHighlightMode) {
    // Disable panning when highlighting
    pdfViewer.style.cursor = "text";
    setupTextSelection();
  } else {
    // Re-enable panning
    pdfViewer.style.cursor = currentZoom > 1.0 ? "grab" : "default";
    cleanupTextSelection();
  }
}



function setupTextSelection() {
  textLayer.addEventListener("mousedown", startTextSelection);
  textLayer.addEventListener("mouseup", endTextSelection);
}

function cleanupTextSelection() {
  textLayer.removeEventListener("mousedown", startTextSelection);
  textLayer.removeEventListener("mouseup", endTextSelection);
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

  // Get all rectangles for the selection (handles multi-line selections properly)
  const clientRects = range.getClientRects();
  const textLayerRect = textLayer.getBoundingClientRect();
  
  if (clientRects.length === 0) return;

  const highlightElements = [];
  const rects = [];

  // Create a highlight element for each rectangle (line)
  for (let i = 0; i < clientRects.length; i++) {
    const rect = clientRects[i];
    
    // Skip very small rectangles (likely empty spaces)
    if (rect.width < 1 || rect.height < 1) continue;

    const highlight = document.createElement("div");
    highlight.className = "user-highlight";
    highlight.style.position = "absolute";

    const relativeLeft = rect.left - textLayerRect.left;
    const relativeTop = rect.top - textLayerRect.top;

    highlight.style.left = relativeLeft + "px";
    highlight.style.top = relativeTop + "px";
    highlight.style.width = rect.width + "px";
    highlight.style.height = rect.height + "px";

    // Add click to remove functionality
    highlight.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isHighlightMode) {
        removeHighlight(highlightData);
      }
    });

    textLayer.appendChild(highlight);
    highlightElements.push(highlight);
    
    // Store rectangle data
    rects.push({
      left: relativeLeft,
      top: relativeTop,
      width: rect.width,
      height: rect.height,
    });
  }

  // Store highlight data with multiple elements and rectangles
  const highlightData = {
    elements: highlightElements,
    text: range.toString(),
    rects: rects,
    scale: currentZoom, // Save the zoom level when highlight was created
  };

  pageHighlights.push(highlightData);
  highlights[currentPage] = pageHighlights;
}

function removeHighlight(highlightData) {
  const pageHighlights = highlights[currentPage] || [];
  const index = pageHighlights.findIndex((h) => h === highlightData);
  if (index > -1) {
    pageHighlights.splice(index, 1);
    
    // Remove all elements for this highlight (handles both single and multi-line highlights)
    if (highlightData.elements) {
      // New format with multiple elements
      highlightData.elements.forEach(element => element.remove());
    } else if (highlightData.element) {
      // Old format with single element (for backward compatibility)
      highlightData.element.remove();
    }
  }
}

function restoreHighlights() {
  const pageHighlights = highlights[currentPage] || [];
  pageHighlights.forEach((highlightData) => {
    // Handle both new format (multiple rects) and old format (single rect)
    const rects = highlightData.rects || [highlightData.rect];
    const elements = [];

    rects.forEach((rect) => {
      const highlight = document.createElement("div");
      highlight.className = "user-highlight";
      highlight.style.position = "absolute";
      highlight.style.left = rect.left + "px";
      highlight.style.top = rect.top + "px";
      highlight.style.width = rect.width + "px";
      highlight.style.height = rect.height + "px";

      highlight.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isHighlightMode) {
          removeHighlight(highlightData);
        }
      });

      textLayer.appendChild(highlight);
      elements.push(highlight);
    });

    // Update highlightData to use new format
    highlightData.elements = elements;
    // Keep old format for backward compatibility
    if (!highlightData.rects && highlightData.rect) {
      highlightData.element = elements[0];
    }
  });
}

// Helper function to merge overlapping rectangles to avoid double-opacity in PDF
function mergeOverlappingRects(rects, scale) {
  if (!rects || rects.length === 0) return [];
  
  // Convert to PDF coordinates and normalize
  const normalizedRects = rects.map(rect => ({
    x: rect.left / scale,
    y: rect.top / scale,
    width: rect.width / scale,
    height: rect.height / scale,
    right: (rect.left + rect.width) / scale,
    bottom: (rect.top + rect.height) / scale
  }));
  
  // Sort by y position (top to bottom), then by x position (left to right)
  normalizedRects.sort((a, b) => a.y - b.y || a.x - b.x);
  
  const mergedRects = [];
  let currentGroup = [normalizedRects[0]];
  
  for (let i = 1; i < normalizedRects.length; i++) {
    const current = normalizedRects[i];
    const lastInGroup = currentGroup[currentGroup.length - 1];
    
    // Check if rectangles are on the same line (similar y position and height)
    const sameLineThreshold = Math.min(lastInGroup.height, current.height) * 0.5;
    const onSameLine = Math.abs(current.y - lastInGroup.y) < sameLineThreshold &&
                       Math.abs(current.height - lastInGroup.height) < sameLineThreshold;
    
    if (onSameLine) {
      // Add to current group if on same line
      currentGroup.push(current);
    } else {
      // Process current group and start new one
      mergedRects.push(mergeGroup(currentGroup));
      currentGroup = [current];
    }
  }
  
  // Process the last group
  if (currentGroup.length > 0) {
    mergedRects.push(mergeGroup(currentGroup));
  }
  
  return mergedRects.flat();
}

// Helper function to merge rectangles in the same group (same line)
function mergeGroup(group) {
  if (group.length === 1) return group;
  
  // Sort by x position
  group.sort((a, b) => a.x - b.x);
  
  const merged = [];
  let current = { ...group[0] };
  
  for (let i = 1; i < group.length; i++) {
    const next = group[i];
    
    // Check if rectangles overlap or are adjacent
    if (next.x <= current.right + 2) { // Small gap tolerance
      // Merge rectangles
      current.width = Math.max(current.right, next.right) - current.x;
      current.right = current.x + current.width;
      current.height = Math.max(current.height, next.height);
    } else {
      // No overlap, save current and start new
      merged.push(current);
      current = { ...next };
    }
  }
  
  merged.push(current);
  return merged;
}

async function savePdfWithHighlights() {
  // Use ArrayBuffer as backup if Uint8Array is empty
  let pdfData = originalPdfBytes;
  if (!originalPdfBytes || originalPdfBytes.length === 0) {
    if (originalPdfArrayBuffer && originalPdfArrayBuffer.byteLength > 0) {
      pdfData = new Uint8Array(originalPdfArrayBuffer);
    } else {
      alert("No PDF loaded or PDF data is empty");
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
          
          // Get the original page from the PDF document
          const originalPage = await pdfDocument.getPage(pageIndex + 1);
          const originalViewport = originalPage.getViewport({ scale: 1.0 });

          // Add highlight annotations for each highlight on this page
          for (const highlight of pageHighlights) {
            // Handle both new format (multiple rects) and old format (single rect)
            const rects = highlight.rects || [highlight.rect];
            // Get the scale that was used when this highlight was created
            const highlightScale = highlight.scale || 1.0;

            // For multi-line highlights, merge overlapping rectangles to avoid double-opacity
            const mergedRects = mergeOverlappingRects(rects, highlightScale);
            
            // Create a rectangle for each merged part of the highlight
            for (const rect of mergedRects) {
              if (!rect) continue; // Skip if rect is undefined

              // Convert from text layer coordinates to PDF coordinates
              // PDF coordinates are from bottom-left, our coordinates are from top-left
              const pdfX = rect.x;
              const pdfY = originalViewport.height - rect.y - rect.height;

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
      }

      // Save the modified PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = (selectedFile || "document");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert("PDF saved with highlights embedded!");
    } else {
      // No highlights, just save the original PDF
      const blob = new Blob([pdfData], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = (selectedFile || "document") + "_copy.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert("PDF saved! (No highlights to embed)");
    }
  } catch (error) {
    console.error("Error saving PDF:", error);
    alert("Error saving PDF: " + error.message);
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
  zoomInfo.textContent = Math.round(currentZoom * 100) + "%";
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

async function fitToWidth() {
  if (!pdfDocument) return;

  try {
    // Get current page to calculate viewport dimensions
    const page = await pdfDocument.getPage(currentPage);
    const baseViewport = page.getViewport({ scale: 1.0 });
    
    // Get the pdf-viewer container dimensions (this is the actual visible area)
    const pdfViewer = document.getElementById("pdf-viewer");
    const viewerWidth = pdfViewer.clientWidth;
    
    // Get any scrollbar width that might reduce available space
    const scrollbarWidth = pdfViewer.offsetWidth - pdfViewer.clientWidth;
    
    // Calculate the maximum width we can use, accounting for:
    // - The canvas border (1px each side = 2px total)
    const borderWidth = 2;
    const availableWidth = viewerWidth - borderWidth;
    
    // Calculate the optimal zoom to fit the PDF width to available width
    const optimalZoom = availableWidth / baseViewport.width;
    
    // Clamp the zoom within allowed limits
    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, optimalZoom));
    
    // Reset pan offset when fitting to width
    panOffsetX = 0;
    panOffsetY = 0;
    
    await zoomTo(clampedZoom);
  } catch (error) {
    console.error("Error fitting to width:", error);
  }
}

// Update cursor based on zoom level
function updateCanvasCursor() {
  if (isHighlightMode) {
    pdfViewer.style.cursor = "text";
  } else {
    pdfViewer.style.cursor = "default";
  }
  
  // Set cursor on canvas specifically for panning when zoomed
  if (pdfCanvas) {
    if (currentZoom > 1.0 && !isHighlightMode) {
      pdfCanvas.style.cursor = "grab";
    } else {
      pdfCanvas.style.cursor = "inherit";
    }
  }
}

// Manual page navigation for notes
async function goToPage(page, autoFocus = false) {
  // More flexible validation: allow navigation to any positive page number
  // but respect totalPages when there's a PDF loaded
  const maxAllowedPage = pdfDocument ? totalPages : Math.max(totalPages, 1000); // Allow up to 1000 pages without PDF
  
  if (page < 1 || page > maxAllowedPage) return;

  // If we're already on the target page, just reload the note content
  if (page === currentPage) {
    loadCurrentPageNote(autoFocus);
    return;
  }

  // Clear any pending auto-save timeout to prevent spurious saves
  clearTimeout(saveTimeout);

  // Double-check: always save current note content before switching
  saveCurrentNote();

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
prevPageBtn.addEventListener("click", goToPreviousPage);
nextPageBtn.addEventListener("click", goToNextPage);
zoomInBtn.addEventListener("click", zoomIn);
zoomOutBtn.addEventListener("click", zoomOut);
fitToWidthBtn.addEventListener("click", fitToWidth);

// Event listeners for search
searchInput.addEventListener("input", debounce(performSearch, 300));
searchInput.addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    if (e.shiftKey) {
      searchPrevious();
    } else {
      searchNext();
    }
  } else if (e.key === "Escape") {
    clearSearch();
    searchInput.blur();
  }
});

searchNextBtn.addEventListener("click", searchNext);
searchPrevBtn.addEventListener("click", searchPrevious);
zoomInfo.addEventListener("click", zoomReset);
highlightBtn.addEventListener("click", toggleHighlightMode);
savePdfBtn.addEventListener("click", savePdfWithHighlights);

// Mouse wheel zoom on PDF viewer
pdfViewer.addEventListener("wheel", async (e) => {
  if (e.ctrlKey || e.metaKey) {
    // Ctrl+wheel or Cmd+wheel for zoom
    e.preventDefault();

    if (e.deltaY < 0) {
      // Scroll up = zoom in
      await zoomIn(e.clientX, e.clientY);
    } else {
      // Scroll down = zoom out
      await zoomOut(e.clientX, e.clientY);
    }
  }
});

// Page input event listeners
pageInput.addEventListener("change", (e) => {
  const newPage = parseInt(e.target.value);
  if (newPage >= 1 && newPage <= totalPages) {
    goToPage(newPage);
  } else {
    // Reset to current page if invalid
    pageInput.value = currentPage;
  }
});

pageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
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
  
  // Clear localStorage backup
  clearLocalStorageNotes();
}

function saveCurrentNote() {
  // Only save if we're actually editing or if there's content to save
  if (!isEditingNote && noteTextarea.value.trim() === "") {
    // If we're not editing and textarea is empty, don't overwrite existing notes
    return;
  }

  // Always save the current content of the textarea
  const currentContent = noteTextarea.value || "";
  const previousContent = notes[currentPage] || "";

  // Only update if content has actually changed
  if (currentContent !== previousContent) {
    notes[currentPage] = currentContent;
    
    // Save to localStorage whenever notes change
    saveNotesToLocalStorage();
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
  const pageWhenTyping = currentPage; // Capture the page number when typing starts
  saveTimeout = setTimeout(() => {
    // Only auto-save if we're still editing and on the same page
    if (isEditingNote && currentPage === pageWhenTyping) {
      saveCurrentNote();
      showSaveConfirmation(); // Show visual feedback like Ctrl+S
    }
  }, 10000); // Save after 10 seconds of no typing
});

// Handle keyboard navigation while editing
noteTextarea.addEventListener("keydown", async (e) => {
  // Insert 4 spaces when Tab is pressed
  if (e.key === "Tab") {
    e.preventDefault();
    const start = noteTextarea.selectionStart;
    const end = noteTextarea.selectionEnd;
    const value = noteTextarea.value;
    
    // Insert 4 spaces at cursor position
    noteTextarea.value = value.substring(0, start) + "\t" + value.substring(end);
    
    // Move cursor after the inserted spaces
    noteTextarea.selectionStart = noteTextarea.selectionEnd = start + 4;
    
    // Trigger input event to update preview
    noteTextarea.dispatchEvent(new Event("input"));
    return;
  }

  // Save with Ctrl+S
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    saveCurrentNote();
    showSaveConfirmation();
    return;
  }

  // Prevent refresh even while editing
  if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
    e.preventDefault();
    return;
  }

  // Allow standard editing shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X)
  if (
    e.ctrlKey &&
    ["z", "y", "a", "c", "v", "x"].includes(e.key.toLowerCase())
  ) {
    // Let these through without interference
    return;
  }

  // Navigate pages while editing with Ctrl+Arrow keys
  if (e.ctrlKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling up to document handler

    let targetPage = currentPage;
    if (e.key === "ArrowLeft" && currentPage > 1) {
      targetPage = currentPage - 1;
    } else if (e.key === "ArrowRight" && currentPage < totalPages) {
      targetPage = currentPage + 1;
    }

    if (targetPage !== currentPage) {
      // Clear any pending auto-save timeout to prevent spurious saves
      clearTimeout(saveTimeout);
      
      // Save current note before switching pages
      saveCurrentNote();

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
  if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
    e.preventDefault();
    return;
  }

  // Focus search bar with Ctrl+F
  if (e.ctrlKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    if (searchInput) {
      searchInput.focus();
      searchInput.select(); // Select all text if any
    }
    return;
  }

  // Only handle shortcuts if not editing a note and not in an input field
  if (!isEditingNote && !e.target.matches("input, textarea")) {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        if (currentPage > 1) {
          await goToPage(currentPage - 1);
        }
        break;
      case "ArrowRight":
        e.preventDefault();
        if (currentPage < totalPages) {
          await goToPage(currentPage + 1);
        }
        break;
    }
  }

  // Zoom controls with Ctrl++, Ctrl+-, and Ctrl+0
  if (e.ctrlKey && (e.key === "+" || e.key === "=")) {
    e.preventDefault();
    await zoomIn();
    return;
  }

  if (e.ctrlKey && e.key === "-") {
    e.preventDefault();
    await zoomOut();
    return;
  }

  // Escape key to exit edit mode
  if (e.key === "Escape" && isEditingNote) {
    e.preventDefault();
    exitEditMode();
    return;
  }

  // Enter key to start editing (when not in edit mode)
  if (
    e.key === "Enter" &&
    !isEditingNote &&
    !e.target.matches("input, textarea, button")
  ) {
    e.preventDefault();
    enterEditMode();
    return;
  }

  // Ctrl+S to save notes manually
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    saveCurrentNote();
    showSaveConfirmation();
    return;
  }

  // Alt key for panning mode when zoomed
  if (e.key === "Alt" && currentZoom > 1.0 && !isHighlightMode) {
    if (pdfViewer) {
      pdfViewer.style.cursor = "grab";
    }
  }
});

// Handle Alt key release
document.addEventListener("keyup", (e) => {
  if (e.key === "Alt") {
    updateCanvasCursor();
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

      // Only support new format with metadata
      if (!data.notes || typeof data.notes !== "object") {
        throw new Error("Invalid notes file format. Expected format: { notes: {...}, totalPages: ..., lastPage: ... }");
      }

      // Deep copy to avoid reference issues and convert string keys to numbers
      notes = {};
      Object.keys(data.notes).forEach(key => {
        const pageNum = parseInt(key);
        if (!isNaN(pageNum) && pageNum > 0) {
          notes[pageNum] = data.notes[key];
        }
      });

      // Calculate the maximum page number from loaded notes
      const notePageNumbers = Object.keys(notes).map(Number).filter(n => !isNaN(n) && n > 0);
      const maxNotePageNumber = notePageNumbers.length > 0 ? Math.max(...notePageNumbers) : 0;
      
      // Update total pages based on context:
      if (!pdfDocument) {
        // No PDF loaded: use the larger between saved totalPages, max note page, or current totalPages
        if (data.totalPages) {
          totalPages = Math.max(data.totalPages, maxNotePageNumber || 1, totalPages);
        } else {
          totalPages = Math.max(maxNotePageNumber || 1, totalPages);
        }
      }

      // Restore last page if available
      if (data.lastPage && data.lastPage <= totalPages) {
        await goToPage(data.lastPage);
      } else {
        // Just reload current page to ensure sync
        loadCurrentPageNote();
      }

      // Update current view
      updatePageInfo();
      updateNavigationButtons();
      
      // Save loaded notes to localStorage to replace old backup
      saveNotesToLocalStorage();
    } catch (err) {
      alert("Error loading notes file: " + err.message);
    }
    
    // Reset input to allow reloading the same file
    loadNotesInput.value = '';
  };
  reader.readAsText(file);
});

// Save notes functionality
saveNotesBtn.addEventListener("click", () => {
  // Save current note before saving file
  saveCurrentNote();

  const data = {
    notes: notes,
    totalPages: totalPages,
    lastPage: currentPage,
    savedAt: new Date().toISOString(),
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
    const confirmClose = confirm(
      "You have unsaved notes. Are you sure you want to close?"
    );
    if (!confirmClose) return;
  }

  // Reset PDF state
  if (pdfDocument) {
    pdfDocument = null;
  }

  // Reset state
  selectedFile = "new_notes";
  currentPage = 1;
  totalPages = 100; // Reset to 100 virtual pages
  currentZoom = 1.0;
  panOffsetX = 0; // Reset pan
  panOffsetY = 0;
  isHighlightMode = false;
  highlights = {};

  // Clear search state
  pdfTextContent = {};
  clearSearch();
  // Clear search input field
  if (searchInput) {
    searchInput.value = "";
  }

  // Reset UI
  highlightBtn.classList.remove("active");

  // Hide PDF and show placeholder
  pdfViewer.style.display = "none";
  pdfPlaceholder.style.display = "flex";
  if (pdfInfo) pdfInfo.style.display = "none";

  // Reset file input
  pdfInput.value = "";

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
window.addEventListener(
  "resize",
  debounce(async () => {
    if (pdfDocument && !renderingPage) {
      await renderPage(currentPage);
    }
  }, 300)
);

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
document.addEventListener("DOMContentLoaded", function () {
  // Check if all required libraries are loaded
  if (typeof pdfjsLib === "undefined") {
    console.error("PDF.js library not loaded");
    return;
  }
  if (typeof marked === "undefined") {
    console.error("Marked library not loaded");
    return;
  }

  // Initialize the app
  initializeApp();

  // Setup panning after initialization
  setupPanning();
});

// Handle files input to load both PDF and notes when selected together
filesInput.addEventListener("change", async function () {
  const files = Array.from(filesInput.files);
  let pdfFile = null;
  let eznFile = null;

  // Find PDF and .ezn files
  for (const file of files) {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      pdfFile = file;
    } else if (file.name.toLowerCase().endsWith(".ezn")) {
      eznFile = file;
    }
  }

  // Load PDF if present
  if (pdfFile) {
    // Set the selected file name for saving notes
    selectedFile = pdfFile.name.replace(/\.pdf$/i, "");
    // Load PDF without clearing notes - only clear if notes file is also provided
    if (!eznFile) {
      // If no notes file is provided, keep existing notes
      await loadPDF(pdfFile);
    } else {
      // If notes file is provided, clear notes first (will be loaded from file)
      clearAllNotes();
      await loadPDF(pdfFile);
    }
  }

  // Load notes if present
  if (eznFile) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        notes = {};
        if (!data.notes || typeof data.notes !== "object") {
          throw new Error("Invalid notes file format. Expected format: { notes: {...}, totalPages: ..., lastPage: ... }");
        }
        notes = JSON.parse(JSON.stringify(data.notes));
        const notePageNumbers = Object.keys(notes).map(Number).filter(n => !isNaN(n) && n > 0);
        const maxNotePageNumber = notePageNumbers.length > 0 ? Math.max(...notePageNumbers) : 0;
        if (!pdfDocument) {
          if (data.totalPages) {
            totalPages = Math.max(data.totalPages, maxNotePageNumber || 1, totalPages);
          } else {
            totalPages = Math.max(maxNotePageNumber || 1, totalPages);
          }
        }
        if (data.lastPage && data.lastPage <= totalPages) {
          if (data.lastPage === currentPage) {
            loadCurrentPageNote();
          } else {
            await goToPage(data.lastPage);
          }
        } else {
          loadCurrentPageNote();
        }
        updatePageInfo();
        updateNavigationButtons();
        
        // Save loaded notes to localStorage to replace old backup
        saveNotesToLocalStorage();
      } catch (err) {
        alert("Error loading notes file: " + err.message);
      }
      filesInput.value = '';
    };
    reader.readAsText(eznFile);
  } else {
    filesInput.value = '';
  }
});

// ==================== SEARCH FUNCTIONALITY ====================

// Debounce function to avoid excessive search calls
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

// Extract text content from PDF page
async function extractTextFromPage(pageNum) {
  if (!pdfDocument || pdfTextContent[pageNum]) {
    return pdfTextContent[pageNum] || "";
  }

  try {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(item => item.str).join(" ");
    pdfTextContent[pageNum] = text;
    return text;
  } catch (error) {
    console.error(`Error extracting text from page ${pageNum}:`, error);
    return "";
  }
}

// Perform search across PDF and notes
async function performSearch() {
  const searchTerm = searchInput.value.trim();
  
  if (searchTerm.length < 2) {
    clearSearch();
    return;
  }

  // If search term hasn't changed, don't search again
  if (searchTerm === lastSearchTerm) {
    return;
  }

  lastSearchTerm = searchTerm;
  searchResults = [];
  currentSearchIndex = -1;

  const searchRegex = new RegExp(escapeRegExp(searchTerm), 'gi');

  try {
    // Search in PDF content
    if (pdfDocument) {
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const text = await extractTextFromPage(pageNum);
        const matches = [...text.matchAll(searchRegex)];
        
        matches.forEach(match => {
          searchResults.push({
            type: 'pdf',
            page: pageNum,
            text: text,
            match: match[0],
            index: match.index
          });
        });
      }
    }

    // Search in notes
    Object.keys(notes).forEach(pageNum => {
      const noteText = notes[pageNum] || "";
      const matches = [...noteText.matchAll(searchRegex)];
      
      matches.forEach(match => {
        searchResults.push({
          type: 'note',
          page: parseInt(pageNum),
          text: noteText,
          match: match[0],
          index: match.index
        });
      });
    });

    // Sort results by page number
    searchResults.sort((a, b) => a.page - b.page);

    updateSearchUI();
    
    // If there are results, go to the first one
    if (searchResults.length > 0) {
      currentSearchIndex = 0;
      await goToSearchResult(0);
    }

  } catch (error) {
    console.error("Error performing search:", error);
  }
}

// Navigate to specific search result
async function goToSearchResult(index) {
  if (index < 0 || index >= searchResults.length) {
    return;
  }

  currentSearchIndex = index;
  const result = searchResults[index];
  
  // Navigate to the page if needed
  if (currentPage !== result.page) {
    await goToPage(result.page);
  }

  // Highlight the result
  highlightSearchResult(result);
  updateSearchUI();
}

// Highlight search result in current view
function highlightSearchResult(result) {
  // Clear previous highlights
  clearSearchHighlights();

  if (result.type === 'note') {
    // Highlight in note textarea
    highlightInTextarea(result);
  } else if (result.type === 'pdf') {
    // Highlight in PDF text layer
    highlightInPdfTextLayer(result);
  }
}

// Highlight text in textarea (notes)
function highlightInTextarea(result) {
  if (!noteTextarea || !result.text) return;

  const textarea = noteTextarea;
  const start = result.index;
  const end = start + result.match.length;
  
  // Focus and select the text
  textarea.focus();
  textarea.setSelectionRange(start, end);
  textarea.scrollTop = Math.max(0, (start / result.text.length) * textarea.scrollHeight - textarea.clientHeight / 2);
}

// Highlight text in PDF text layer
function highlightInPdfTextLayer(result) {
  const textLayer = document.getElementById("text-layer");
  if (!textLayer) return;

  // Find text nodes and highlight matching text
  const walker = document.createTreeWalker(
    textLayer,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  let fullText = "";
  const textNodes = [];

  // Collect all text nodes and build full text
  while (node = walker.nextNode()) {
    textNodes.push({
      node: node,
      startIndex: fullText.length,
      endIndex: fullText.length + node.textContent.length
    });
    fullText += node.textContent;
  }

  // Find the matching text position in the accumulated text
  const searchRegex = new RegExp(escapeRegExp(result.match), 'gi');
  const matches = [...fullText.matchAll(searchRegex)];
  
  if (matches.length > 0) {
    const match = matches[0]; // Take first match for simplicity
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    // Find which text nodes contain the match
    textNodes.forEach(({node, startIndex, endIndex}) => {
      if (startIndex < matchEnd && endIndex > matchStart) {
        // This node contains part of the match
        const nodeMatchStart = Math.max(0, matchStart - startIndex);
        const nodeMatchEnd = Math.min(node.textContent.length, matchEnd - startIndex);
        
        if (nodeMatchStart < nodeMatchEnd) {
          highlightTextNode(node, nodeMatchStart, nodeMatchEnd);
        }
      }
    });
  }
}

// Highlight portion of a text node
function highlightTextNode(textNode, start, end) {
  const parent = textNode.parentNode;
  const text = textNode.textContent;
  
  // Split the text node
  const beforeText = text.substring(0, start);
  const matchText = text.substring(start, end);
  const afterText = text.substring(end);
  
  // Create new nodes
  const beforeNode = document.createTextNode(beforeText);
  const highlightNode = document.createElement("span");
  highlightNode.className = "search-highlight current";
  highlightNode.textContent = matchText;
  const afterNode = document.createTextNode(afterText);
  
  // Replace original text node
  parent.insertBefore(beforeNode, textNode);
  parent.insertBefore(highlightNode, textNode);
  parent.insertBefore(afterNode, textNode);
  parent.removeChild(textNode);
  
  // Scroll highlight into view
  setTimeout(() => {
    highlightNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// Clear search highlights
function clearSearchHighlights() {
  // Clear PDF highlights
  const highlights = document.querySelectorAll(".search-highlight");
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    parent.insertBefore(document.createTextNode(highlight.textContent), highlight);
    parent.removeChild(highlight);
    parent.normalize(); // Merge adjacent text nodes
  });
}

// Navigate to next search result
function searchNext() {
  if (searchResults.length === 0) return;
  
  const nextIndex = (currentSearchIndex + 1) % searchResults.length;
  goToSearchResult(nextIndex);
}

// Navigate to previous search result
function searchPrevious() {
  if (searchResults.length === 0) return;
  
  const prevIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
  goToSearchResult(prevIndex);
}

// Clear search and results
function clearSearch() {
  searchResults = [];
  currentSearchIndex = -1;
  lastSearchTerm = "";
  clearSearchHighlights();
  updateSearchUI();
}

// Update search UI elements
function updateSearchUI() {
  const hasResults = searchResults.length > 0;
  const currentResult = currentSearchIndex + 1;
  
  searchPrevBtn.disabled = !hasResults;
  searchNextBtn.disabled = !hasResults;
  
  if (hasResults) {
    searchCurrentSpan.textContent = currentResult;
    searchTotalSpan.textContent = searchResults.length;
    searchResultsInfo.style.display = "block";
  } else {
    searchResultsInfo.style.display = "none";
  }
}

// Escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Add navigation confirmation for any URL change
window.addEventListener('beforeunload', function(event) {
  // Show confirmation dialog when user tries to leave the page
  const confirmationMessage = 'You are about to leave the page. Make sure to save your notes before leaving.';
  
  // Standard way to show confirmation dialog
  event.preventDefault();
  event.returnValue = confirmationMessage;
  return confirmationMessage;
});
