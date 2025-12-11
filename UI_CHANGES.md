# 📱 UI Changes - What Users Will See

## Before
```
┌─ Your Resume ──────────────────┐
│                                │
│  [Textarea for pasting text]   │
│  e.g. "Software Engineer..."   │
│                                │
│                                │
│                                │
└────────────────────────────────┘
```

## After
```
┌─ Your Resume ──────────────────────────────┐
│                                            │
│  [Textarea for pasting text]               │
│  Paste your resume text here...            │
│                                            │
│                                            │
├────────────────────────────────────────────┤
│  Or Upload PDF                             │
│                                            │
│  [Choose File...] [Upload & Extract] ◄─── New!
│  Selected: resume.pdf                 ◄─── New!
│                                            │
└────────────────────────────────────────────┘
```

## User Flow

### 1️⃣ Select PDF
```
User clicks "Choose File"
    ↓
File picker opens
    ↓
User selects resume.pdf
    ↓
UI shows "Selected: resume.pdf"
```

### 2️⃣ Upload & Extract
```
User clicks "Upload & Extract" button
    ↓
Button shows "Extracting..." (loading state)
    ↓
PDF uploads to Supabase Storage
    ↓
Kestra workflow starts automatically
```

### 3️⃣ Auto-Fill Resume
```
System extracts text from PDF (2-4 seconds)
    ↓
Resume textarea AUTO-FILLS with extracted text
    ↓
File input resets
    ↓
User can now click "Run Analysis Agent"
```

## Validation Messages (Error States)

```
❌ "Please upload a PDF file"
   → User selected .doc or .txt file

❌ "File size must be less than 10MB"
   → PDF is too large

❌ "Please select a file and log in"
   → User not logged in or no file selected

❌ "Upload failed: [error message]"
   → Supabase or network error

⏳ "Extraction timeout. Please try again."
   → Kestra took too long (60 second limit)
```

## Success Flow

```
✅ File selected
  ↓
📤 Upload & Extract (button clickable)
  ↓
⏳ "Extracting..." (button disabled)
  ↓
📥 Resume textarea auto-fills
  ↓
✅ "Run Analysis Agent" (ready to click)
```

## Button States

### Normal State
```
[Upload & Extract] 
- Enabled: when file is selected
- Color: Cyan (bg-cyan-600)
- Hover: Darker cyan
```

### Loading State
```
[Extracting...]
- Disabled: while processing
- Color: Grayed out
- Cursor: not-allowed
```

### Error State
```
User sees red error message below:
"Please upload a PDF file"
- Color: Rose-400 (red)
- Auto-dismisses on next action
```

## Accessibility Features

✅ File input accepts: .pdf only
✅ File size validation: <= 10MB
✅ Clear error messages
✅ Loading state feedback
✅ Disabled button during processing
✅ File name display for confirmation

## Device Support

✅ Desktop: Full experience
✅ Tablet: Responsive layout
✅ Mobile: Stacked layout, touch-friendly

## Performance

- PDF upload: Instant
- Kestra extraction: 2-4 seconds
- Frontend polling: Every 2 seconds (up to 60 times)
- Timeout: 2 minutes total

