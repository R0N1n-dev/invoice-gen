package studio.billfold.app;

import android.graphics.Color;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Billfold draws edge-to-edge on every Android version. The window insets
 * (status bar, navigation bar, cutout, keyboard) are applied by Capacitor's
 * built-in SystemBars plugin, configured with `insetsHandling: 'native'` in
 * capacitor.config.ts, so page content can never slide under the system bars.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
    }
}
