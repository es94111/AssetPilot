# WorkManager (used for the home-screen widget background sync) initializes its
# internal Room database via reflection at process start, through the
# androidx.startup.InitializationProvider ContentProvider -> WorkManagerInitializer.
# R8's default rules strip the no-arg constructor of the generated Room
# "_Impl" class, which crashes the app on every launch in release builds with:
#   java.lang.NoSuchMethodException: androidx.work.impl.WorkDatabase_Impl.<init> []
-keep class androidx.work.impl.WorkDatabase_Impl {
    public <init>();
}
-keep class * extends androidx.room.RoomDatabase
