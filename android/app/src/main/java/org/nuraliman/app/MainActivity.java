package org.nuraliman.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Host activity for the Nur Al-Iman PWA bundle.
 *
 * Responsibilities beyond Capacitor's defaults:
 *  - create the "prayer-times" notification channel on first launch, because
 *    Android 8+ silently drops notifications posted to an unknown channel;
 *  - keep the WebView alive across configuration changes (declared in the
 *    manifest via android:configChanges) so an in-progress recitation or a
 *    running countdown is not destroyed by a rotation;
 *  - report lifecycle transitions to the web layer so the prayer scheduler can
 *    reschedule instead of relying on a background timer the OS may freeze.
 */
public class MainActivity extends BridgeActivity {

    /**
     * Channel used for prayer time alerts. Importance HIGH (4) rather than
     * MAX (5) so the alert is audible and heads-up, but does not bypass Do Not
     * Disturb unless the user has enabled that per-prayer in Settings.
     */
    public static final String CHANNEL_PRAYER_TIMES = "prayer-times";

    /** Lower-importance channel for pre-prayer reminders. */
    public static final String CHANNEL_PRAYER_REMINDERS = "prayer-reminders";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        if (manager.getNotificationChannel(CHANNEL_PRAYER_TIMES) == null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_PRAYER_TIMES,
                    getString(R.string.channel_prayer_times),
                    NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription(getString(R.string.channel_prayer_times_description));
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[] { 0, 400, 300, 400 });
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(channel);
        }

        if (manager.getNotificationChannel(CHANNEL_PRAYER_REMINDERS) == null) {
            NotificationChannel reminders = new NotificationChannel(
                    CHANNEL_PRAYER_REMINDERS,
                    getString(R.string.channel_prayer_reminders),
                    NotificationManager.IMPORTANCE_DEFAULT);
            reminders.setDescription(getString(R.string.channel_prayer_reminders_description));
            reminders.enableVibration(false);
            reminders.setShowBadge(false);
            manager.createNotificationChannel(reminders);
        }
    }
}
