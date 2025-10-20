# PDF Export Feature

## Overview
The PDF Export feature allows you to create a comprehensive PDF document that combines your slides and notes in a professional, easy-to-read format.

## How It Works

### Export Format
- **Orientation**: Landscape (horizontal) format
- **Layout**: Two-column design
  - **Left side**: PDF slide/page
  - **Right side**: Corresponding notes
- **All pages included**: Even pages without notes are exported with an empty notes section

### Markdown Rendering
Your notes are written in Markdown format (in .ezn files, which are JSON files containing Markdown text), and when exported:
- Headings are preserved with spacing
- Lists (bullet and numbered) are formatted with bullets (•)
- Text formatting (bold, italic) is maintained
- Code blocks and inline code are marked with backticks
- Links are shown with their URLs in parentheses

### How to Export

1. **Load your PDF and notes** (or just PDF if you want to export without notes)
2. Click the **"Export PDF"** button in the navigation bar (blue button with export icon)
3. Wait for the export process to complete (you'll see progress updates)
4. The PDF will be automatically downloaded with the filename: `[your-notes-name]_notes_export.pdf`

### Export Process Details
- Each page of your original PDF is rendered as an image
- The image is scaled to fit perfectly in the left half of the page
- Notes for each page are processed from Markdown to formatted text
- If notes are too long for a single page, they are truncated with "..." indicator
- Pages without notes show "No notes for this page" message

### Use Cases
- **Study materials**: Create comprehensive study guides with slides and your annotations
- **Presentations**: Share your presentation with speaker notes included
- **Documentation**: Combine technical documents with your comments and explanations
- **Teaching**: Distribute course materials with lecture notes to students
- **Printing**: Print your annotated materials for offline review

### Technical Details
- Uses **jsPDF** library for PDF generation
- PDF format: A4 landscape (297mm x 210mm)
- Images are exported as JPEG with 80% quality for optimal file size
- Notes text is automatically wrapped to fit the available space
- Font size: 10pt for readability

### Limitations
- Very long notes may be truncated on a single page
- Complex Markdown formatting is simplified to plain text with basic formatting
- Images in Markdown notes are not included (text only)
- Tables in Markdown are converted to plain text

### Tips
- Keep your notes concise for better export results
- Use clear Markdown formatting (headings, lists) for better readability
- Review the export to ensure all important information is included
- If notes are truncated, consider splitting them across multiple pages in your original notes

## Browser Compatibility
The export feature works in all modern browsers that support:
- Canvas API
- Blob/File APIs
- ES6 JavaScript features

Tested on:
- Chrome/Edge (recommended)
- Firefox
- Safari
