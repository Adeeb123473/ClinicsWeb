-- The in-app notifications and platform-announcements features were removed.
-- PlatformSettings (from 025) is kept — only the Announcements table it introduced is dropped here.
DROP TABLE IF EXISTS Announcements;
GO

DROP TABLE IF EXISTS Notifications;
