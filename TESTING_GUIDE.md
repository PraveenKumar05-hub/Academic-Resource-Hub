## Quick Start Guide - Testing the Fixes

### Step 1: Start Your Server
```bash
cd e:\academic-resource-hub\server
npm start
```
You should see: `Server running on port 5000`

### Step 2: Start Your Client
```bash
cd e:\academic-resource-hub\client
npm run dev
```
You should see: `Local: http://localhost:5173`

### Step 3: Test Materials Upload (as Faculty)

1. Open http://localhost:5173
2. Login as Faculty
3. Navigate to **Upload Materials**
4. Fill in the form:
   - **Title**: "Chapter 1 - Introduction"
   - **Subject**: "Mathematics"
   - **Department Name**: (Your department name - **must match exactly**)
   - **Year**: 1
   - **Section**: A
   - Select a PDF/Document file
5. Click **Upload Material**
6. Check browser console (F12) for:
   ```
   ✅ "Uploading material: {...}"
   ✅ "Upload response: {url: 'https://res.cloudinary.com/...'}"
   ✅ "Material uploaded successfully!"
   ```

### Step 4: View Materials (as Student)

1. Login as a **Student** in that department with:
   - **Year**: 1
   - **Section**: A
2. Navigate to **Study Materials**
3. Check browser console (F12) for:
   ```
   ✅ "Fetching materials..."
   ✅ "Materials response: [{...}]"
   ```
4. Should see the material you just uploaded
5. Click **Download** → file opens in new tab

### Step 5: Test Assignments (as Faculty)

1. Login as **Faculty**
2. Navigate to **Assignments**
3. Click **Create Assignment** button
4. Fill form:
   - **Title**: "Assignment 1"
   - **Subject**: "Mathematics"
   - **Year**: 1
   - **Section**: A
   - **Due Date**: (any future date)
   - **Description**: (optional)
   - Select a file (optional)
5. Click **Create**
6. Check browser console:
   ```
   ✅ "Creating assignment with file: {...}"
   ✅ "Assignment created: {...}"
   ✅ "Assignment created successfully!"
   ```

### Step 6: View Assignments (as Student)

1. Login as **Student** (Year 1, Section A)
2. Navigate to **My Assignments**
3. Check browser console:
   ```
   ✅ "Fetching assignments, page: 1"
   ✅ "Assignments response: {...}"
   ```
4. Should see assignment(s) you just created
5. If file attached, click **Download Attachment**
6. Check console: `"Opening file: https://res.cloudinary.com/..."`
7. File should open in new tab

### Step 7: Troubleshooting

**If materials don't appear:**
- Check if you used exact department name during upload
- Check if year/section match your student profile
- Open browser console (F12) → Network tab
- Click refresh, check the GET /api/materials response
- Look for error messages in console

**If download fails:**
- Check file URL in network response
- Should start with `https://res.cloudinary.com/`
- Check browser console for JavaScript errors
- Try opening URL directly in browser

**If assignments don't appear:**
- Verify year and section match exactly
- Check console output: "Fetching assignments for user: {...}"
- Check if department names match
- Look for validation errors in server console

---

## Key Points to Verify

✅ Materials uploaded by faculty visible only to students in same year/section
✅ Assignments created by faculty visible only to students in same year/section  
✅ Download buttons work for both materials and assignments
✅ "No file attached" message shown when no file uploaded
✅ Role-based access working (students don't see admin options)

---

## Server Console Output to Watch For

### Successful Material Upload:
```
Upload request: { title: 'Chapter 1 - Introduction', subject: 'Mathematics', departmentName: 'CSE', year: 1, section: 'A' }
Cloudinary upload result: https://res.cloudinary.com/...
```

### Successful Assignment Creation:
```
Creating assignment with file: { title: 'Assignment 1', subject: 'Mathematics', year: 1, section: 'A', department: 'CSE' }
Assignment before save: { ... }
Assignment saved successfully: 507f1f77bcf86cd799439011
```

### Successful Assignment Fetch:
```
Fetching assignments for user: { userId: '...', role: 'student', dept: 'CSE', year: 1, section: 'A' }
Filter applied: { department: 'CSE', year: 1, section: 'A' }
Found 2 assignments, total: 2
```

---

## Expected Behavior After Fixes

| Action | Before | After |
|--------|--------|-------|
| Upload material | ❌ Sometimes fails silently | ✅ Clear success/error messages |
| View materials | ❌ Empty or wrong materials | ✅ Only your year/section |
| Download file | ❌ "Can't open this file" | ✅ Opens in new tab |
| Create assignment | ❌ Not visible to all students | ✅ Only visible to matching year/section |
| Access assignment | ❌ Shows but download fails | ✅ Downloads work properly |

---

**Created**: February 17, 2026
**Status**: Ready for Testing ✅
