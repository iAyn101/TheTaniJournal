# Local Media Storage

The Tani Journal uses **local file storage** for all user-uploaded media (cover images, audio, video files).

## How it Works

1. **Upload Endpoint**: `POST /api/media/upload`
   - Accepts file uploads from authenticated users
   - Stores files in `backend/media/` directory
   - Returns a `/media/{filename}` URL for access

2. **Static Serving**: Files in `backend/media/` are served statically via the `/media/` route
   - Configured in `backend/server.py`: `app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")`

3. **Frontend Usage**:
   - Editor uploads cover images: `POST /api/media/upload`
   - Receives URL back: `/media/uuid_filename.ext`
   - Stores URL in post document (MongoDB)
   - Can reference audio/video URLs directly (no upload required)

## File Organization

```
backend/
├── media/
│   ├── {uuid_filename1.jpg}  # Uploaded cover images
│   ├── {uuid_filename2.png}
│   └── ...
└── server.py  # Static file mounting at app.mount("/media", ...)
```

## Security Notes

- Files are stored with UUID prefix to avoid collisions
- Requires authentication to upload (`POST /media/upload` requires valid session)
- Files are not automatically cleaned up (consider implementing cleanup for large deployments)
- No file type validation beyond browser Accept header

## Removed Dependencies

- **backend**: Removed unused `emergentintegrations==0.2.0` dependency
- **frontend**: `@emergentbase/visual-edits` is optional and gracefully disabled if not installed

## Future Enhancements

- Add file size limits and validation
- Implement periodic cleanup of orphaned files
- Consider S3/Cloud Storage integration for production
- Add CDN caching headers for static media files
