# Taking notes on PDF made easy

This is a simple tool to **take notes alongside a PDF document all in a single web interface**.

It allows you to view the PDF, take notes, and save or load them from a file.

**Notes are independent** of the document so make sure to load the correct one.

## ⚠️ Use with caution
This is a simple project made for personal use and learning purposes. It may contain bugs and is not intended for production use. Use at your own risk.

Always remember to save often your notes since the app does not use
local storage or any form of auto-save.

## ✨ Features
- 📖 View PDF documents with zoom and navigation controls
- 📝 Take notes alongside the PDF with page synchronization
- 💾 Save notes to a file (.ezn format)
- 📂 Load notes from a file
- 📄 Write markdown formatted notes with live preview
- 🔍 Search for keywords across notes and PDF
- 🎨 Highlight text directly in the PDF
- 📱 Responsive design - works on desktop, tablet, and mobile
- ⚡ Fast loading with multiple file selection
- 🔄 Auto-sync between PDF pages and corresponding notes

## 🚀 How to use

### Installation
Simply clone or download the repo and run the installation script depending on your OS:

**Windows:**
```batch
install.bat
```

**Linux:**
```bash
./install.sh
```

This will create a desktop icon from which you can launch the app.

Alternatively, you can run the app directly by clicking on the `index.html` file.

A web page is also available at: [https://sevetom.github.io/easy-notes/](https://sevetom.github.io/easy-notes/)

### 📋 Getting Started

1. **Load Files**: Use the toolbar buttons to load your content:
   - 🔵 **Blue button** (PDF + Notes icon): Load both a PDF and notes file at once
   - 📄 **Load PDF**: Load only a PDF document
   - 📝 **Load Notes**: Load only a notes file (.ezn)

2. **Navigate the PDF**:
   - Use **← →** arrow buttons or keyboard arrows to change pages
   - Enter a page number directly in the input field
   - **Zoom in/out** with + - buttons or Ctrl+mouse wheel
   - **Pan** by clicking and dragging on the PDF

3. **Take Notes**:
   - Click on the notes area to start writing
   - Notes are **automatically linked to the current PDF page**
   - Use **Markdown formatting** for rich text (headers, lists, bold, italic, etc.)
   - Press **Escape** to finish editing and see the formatted preview

4. **Highlight Text** (Optional):
   - Click the **highlighter button** 🖍️ to enter highlight mode
   - Click and drag over text in the PDF to highlight it
   - Click on highlighted text to remove the highlight

5. **Save Your Work**:
   - Click **Save** 💾 to download your notes as a .ezn file
   - The file will be named after your PDF (e.g., "document.ezn")
   - You can load this file later to continue working

### 💡 Pro Tips

- **Multi-file loading**: Select both PDF and .ezn files at once with the blue button for instant setup
- **Page sync**: Notes automatically sync with the current PDF page - each page has its own notes
- **Keyboard shortcuts**: 
  - `←` `→` Navigate pages
  - `Enter` Start editing notes
  - `Esc` Finish editing
  - `Ctrl + ←` `→` Navigate while editing
  - `Ctrl + S` Quick save
  - `Ctrl + F` Search for a word globally
- **No PDF needed**: You can take notes without loading a PDF - just start typing!

### 🔧 File Formats

- **PDF files**: Standard PDF documents (.pdf)
- **Notes files**: Easy Notes format (.ezn) - contains your notes, page info, and settings
- **Export**: Notes are saved in JSON format for easy backup and sharing