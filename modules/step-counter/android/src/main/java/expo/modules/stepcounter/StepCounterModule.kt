package expo.modules.stepcounter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android's hardware step counter, kept running while the app is in the background.
 *
 * expo-sensors' Pedometer unregisters its listener as soon as the app leaves the screen,
 * which would freeze treadmill distance whenever the phone is locked or Spotify is open.
 * This listener stays registered until stop() is called. The location foreground service
 * keeps the process alive during a run, so step events keep arriving.
 *
 * read() returns the raw counter (steps since the phone booted), so JS can keep its own
 * baseline in the saved run and survive a JS restart without losing steps.
 */
class StepCounterModule : Module() {
  @Volatile private var latest: Double = -1.0
  @Volatile private var listening = false

  private val listener = object : SensorEventListener {
    override fun onSensorChanged(event: SensorEvent) {
      latest = event.values[0].toDouble()
      sendEvent("onStepCount", mapOf("total" to latest))
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
  }

  private fun sensorManager(): SensorManager? =
    appContext.reactContext?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  private fun startListening(): Boolean {
    if (listening) return true
    val manager = sensorManager() ?: return false
    val sensor = manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return false
    // No batching delay: report each step as it happens.
    listening = manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_FASTEST, 0)
    return listening
  }

  private fun stopListening() {
    if (listening) {
      sensorManager()?.unregisterListener(listener)
      listening = false
    }
    latest = -1.0
  }

  override fun definition() = ModuleDefinition {
    Name("StrideStepCounter")

    Events("onStepCount")

    Function("isAvailable") {
      sensorManager()?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
    }

    Function("start") {
      startListening()
    }

    /** Latest raw counter value, or -1 before the first reading. */
    Function("read") {
      if (listening) {
        // Ask the sensor to deliver anything it is holding back, for the next read.
        sensorManager()?.flush(listener)
      }
      latest
    }

    Function("stop") {
      stopListening()
    }

    OnDestroy {
      stopListening()
    }
  }
}
