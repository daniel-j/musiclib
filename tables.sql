PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE tracks (
    "file" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "time_added" INTEGER NOT NULL,
    "time_updated" INTEGER,
    "last_modified" INTEGER NOT NULL,
    "deleted" INTEGER NOT NULL DEFAULT (0),
    "needs_update" INTEGER NOT NULL DEFAULT (0),
    "title" TEXT,
    "artist" TEXT,
    "album" TEXT,
    "albumartist" TEXT,
    "composer" TEXT,
    "original_artist" TEXT,
    "duration" INTEGER,
    "year" INTEGER,
    "url" TEXT,
    "comment" TEXT,
    "copyright" TEXT,
    "track" INTEGER,
    "track_total" INTEGER,
    "disc" INTEGER,
    "genre" TEXT,
    "bpm" INTEGER,
    "bitrate" INTEGER,
    "format" TEXT,
    "cover_mime" TEXT,
    "cover_name" TEXT,
    "rating" INTEGER
);
CREATE TABLE upload (
    "file" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "time_uploaded" INTEGER NOT NULL
);
COMMIT;
