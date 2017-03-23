PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE tracks (
    "file" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "time_added" INTEGER NOT NULL,
    "time_updated" INTEGER,
    "deleted" INTEGER NOT NULL DEFAULT (0),
    "needs_update" INTEGER NOT NULL DEFAULT (0),
    "title" TEXT,
    "artist" TEXT,
    "album" TEXT,
    "albumartist" TEXT,
    "composer" TEXT,
    "performer" TEXT,
    "year" INTEGER,
    "url" TEXT,
    "comment" TEXT,
    "track" INTEGER,
    "disc" INTEGER,
    "genre" TEXT,
    "bpm" INTEGER,
    "duration" INTEGER,
    "bitrate" INTEGER,
    "format" TEXT,
    "has_artwork" INTEGER,
    "rating" INTEGER
);
CREATE TABLE upload (
    "file" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "time_uploaded" INTEGER NOT NULL
);
COMMIT;
