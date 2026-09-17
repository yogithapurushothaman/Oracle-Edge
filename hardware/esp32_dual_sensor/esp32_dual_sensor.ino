/*
 * ==============================================================================
 * ORACLE Edge - Dual-Sensor Municipal Flood Sentinel Node Firmware v2.0
 * ==============================================================================
 * 
 * Hardware Pin Connections:
 * 
 * --- Node 1: Metro Hospital (Asset ID: H01) ---
 *   - Water Level Sensor: GPIO 36 (VP / ADC1_CH0)
 *   - Red Critical LED:   GPIO 18
 *   - Yellow Warning LED: GPIO 19
 *   - Green Safe LED:     GPIO 21
 *   - Piezo Buzzer:       GPIO 25
 * 
 * --- Node 2: River Bridge (Asset ID: B17) ---
 *   - Water Level Sensor: GPIO 32 (ADC1_CH4)
 *   - Red Critical LED:   GPIO 22
 *   - Yellow Warning LED: GPIO 23
 *   - Green Safe LED:     GPIO 13
 *   - Piezo Buzzer:       GPIO 26
 * 
 * --- Threshold Calibration ---
 *   - Dry Cutoff:       < 0.2 cm  (Sensor reads 0.0 cm)
 *   - Yellow Alert:     >= 3.0 cm (Yellow LED ON, Green/Red OFF)
 *   - Critical Red:     >= 4.0 cm (Red LED ON, Buzzer ON, Yellow/Green OFF)
 *   - Safe Baseline:    < 3.0 cm  (Green LED ON, Yellow/Red OFF, Buzzer OFF)
 * 
 * --- Cloud / Edge Transport ---
 *   - Dual-payload JSON telemetry format targeting /api/v1/sensors/telemetry
 *   - Supports HTTPS via WiFiClientSecure with setInsecure() for localtunnel
 *   - Custom header: "Bypass-Tunnel-Reminder: true"
 * ==============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ==========================================
// 1. Network & Server Configuration
// ==========================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Server Endpoint (Supports local IP, ngrok, or localtunnel HTTPS)
// Example Local:       "http://192.168.0.100:8000/api/v1/sensors/telemetry"
// Example Tunnel:      "https://metal-bushes-march.loca.lt/api/v1/sensors/telemetry"
const char* API_ENDPOINT  = "https://metal-bushes-march.loca.lt/api/v1/sensors/telemetry";
const char* DEVICE_ID     = "ORACLE-ESP32-01";

const unsigned long TELEMETRY_INTERVAL_MS = 2500; // Sample and transmit every 2.5s

// ==========================================
// 2. Hardware Pin Mappings
// ==========================================
// Node 1: Metro Hospital (H01)
#define SENSOR_H01_PIN   36  // VP (ADC1)
#define LED_H01_RED      18
#define LED_H01_YELLOW   19
#define LED_H01_GREEN    21
#define BUZZER_H01_PIN   25

// Node 2: River Bridge (B17)
#define SENSOR_B17_PIN   32  // ADC1
#define LED_B17_RED      22
#define LED_B17_YELLOW   23
#define LED_B17_GREEN    13
#define BUZZER_B17_PIN   26

// ==========================================
// 3. Calibration Constants & State Tracking
// ==========================================
const float DRY_CUTOFF_CM     = 0.20; // Ignore capillary noise below 0.2 cm
const float YELLOW_ALERT_CM   = 3.00; // Elevated warning threshold
const float CRITICAL_ALERT_CM = 4.00; // Emergency evacuation threshold

// Sensor ADC Calibration (12-bit ADC: 0 - 4095)
const int   ADC_DRY_BASELINE   = 300;   // Baseline dry raw ADC count
const int   ADC_MAX_SUBMERGE   = 3100;  // Fully submerged raw ADC count
const float MAX_CALIB_DEPTH_CM = 4.5;   // Maximum measurable depth on probe

float prevWaterH01 = 0.0;
float prevWaterB17 = 0.0;
unsigned long prevSampleTime = 0;

// ==========================================
// 4. Sensor Reading & Calibration Logic
// ==========================================
float readCalibratedWaterLevelCM(int pin) {
  long sum = 0;
  const int SAMPLES = 16;
  for (int i = 0; i < SAMPLES; i++) {
    sum += analogRead(pin);
    delayMicroseconds(250);
  }
  float rawAdc = (float)sum / (float)SAMPLES;

  if (rawAdc < ADC_DRY_BASELINE + 50) {
    return 0.0; // Completely dry
  }

  float depth = ((rawAdc - ADC_DRY_BASELINE) / (float)(ADC_MAX_SUBMERGE - ADC_DRY_BASELINE)) * MAX_CALIB_DEPTH_CM;
  if (depth < DRY_CUTOFF_CM) {
    depth = 0.0;
  }
  if (depth > 5.5) depth = 5.5;
  return depth;
}

// ==========================================
// 5. Actuator Control Helpers
// ==========================================
void setNode1Actuators(float depth, bool backendCritical, bool buzzerSilenced) {
  if (depth >= CRITICAL_ALERT_CM || backendCritical) {
    digitalWrite(LED_H01_RED, HIGH);
    digitalWrite(LED_H01_YELLOW, LOW);
    digitalWrite(LED_H01_GREEN, LOW);
    if (!buzzerSilenced) {
      tone(BUZZER_H01_PIN, 2400); // 2.4 kHz alarm tone
    } else {
      noTone(BUZZER_H01_PIN);
    }
  } else if (depth >= YELLOW_ALERT_CM) {
    digitalWrite(LED_H01_RED, LOW);
    digitalWrite(LED_H01_YELLOW, HIGH);
    digitalWrite(LED_H01_GREEN, LOW);
    noTone(BUZZER_H01_PIN);
  } else {
    digitalWrite(LED_H01_RED, LOW);
    digitalWrite(LED_H01_YELLOW, LOW);
    digitalWrite(LED_H01_GREEN, HIGH);
    noTone(BUZZER_H01_PIN);
  }
}

void setNode2Actuators(float depth, bool backendCritical, bool buzzerSilenced) {
  if (depth >= CRITICAL_ALERT_CM || backendCritical) {
    digitalWrite(LED_B17_RED, HIGH);
    digitalWrite(LED_B17_YELLOW, LOW);
    digitalWrite(LED_B17_GREEN, LOW);
    if (!buzzerSilenced) {
      tone(BUZZER_B17_PIN, 2400); // 2.4 kHz alarm tone
    } else {
      noTone(BUZZER_B17_PIN);
    }
  } else if (depth >= YELLOW_ALERT_CM) {
    digitalWrite(LED_B17_RED, LOW);
    digitalWrite(LED_B17_YELLOW, HIGH);
    digitalWrite(LED_B17_GREEN, LOW);
    noTone(BUZZER_B17_PIN);
  } else {
    digitalWrite(LED_B17_RED, LOW);
    digitalWrite(LED_B17_YELLOW, LOW);
    digitalWrite(LED_B17_GREEN, HIGH);
    noTone(BUZZER_B17_PIN);
  }
}

// ==========================================
// 6. Setup Routine
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println(" ORACLE Edge: Dual-Sensor Municipal Flood Sentinel");
  Serial.println(" Node 1: Metro Hospital (H01) | Node 2: River Bridge (B17)");
  Serial.println("=======================================================");

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  pinMode(SENSOR_H01_PIN, INPUT);
  pinMode(SENSOR_B17_PIN, INPUT);

  pinMode(LED_H01_RED, OUTPUT);
  pinMode(LED_H01_YELLOW, OUTPUT);
  pinMode(LED_H01_GREEN, OUTPUT);
  pinMode(BUZZER_H01_PIN, OUTPUT);

  pinMode(LED_B17_RED, OUTPUT);
  pinMode(LED_B17_YELLOW, OUTPUT);
  pinMode(LED_B17_GREEN, OUTPUT);
  pinMode(BUZZER_B17_PIN, OUTPUT);

  // Initial self-test sequence
  digitalWrite(LED_H01_GREEN, HIGH);
  digitalWrite(LED_B17_GREEN, HIGH);
  delay(300);
  digitalWrite(LED_H01_YELLOW, HIGH);
  digitalWrite(LED_B17_YELLOW, HIGH);
  delay(300);
  digitalWrite(LED_H01_RED, HIGH);
  digitalWrite(LED_B17_RED, HIGH);
  delay(400);

  digitalWrite(LED_H01_RED, LOW);
  digitalWrite(LED_H01_YELLOW, LOW);
  digitalWrite(LED_B17_RED, LOW);
  digitalWrite(LED_B17_YELLOW, LOW);
  noTone(BUZZER_H01_PIN);
  noTone(BUZZER_B17_PIN);

  Serial.printf("[WIFI] Connecting to SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(400);
    Serial.print(".");
    digitalWrite(LED_H01_YELLOW, !digitalRead(LED_H01_YELLOW));
    digitalWrite(LED_B17_YELLOW, !digitalRead(LED_B17_YELLOW));
    attempts++;
  }

  digitalWrite(LED_H01_YELLOW, LOW);
  digitalWrite(LED_B17_YELLOW, LOW);

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.printf("[WIFI] IP Address: %s | Gateway: %s\n", WiFi.localIP().toString().c_str(), WiFi.gatewayIP().toString().c_str());
  } else {
    Serial.println("\n[WARN] Wi-Fi offline. Running in local standalone bench mode.");
  }

  prevSampleTime = millis();
}

// ==========================================
// 7. Main Execution Loop
// ==========================================
void loop() {
  unsigned long now = millis();
  if (now - prevSampleTime >= TELEMETRY_INTERVAL_MS) {
    float dtMinutes = (now - prevSampleTime) / 60000.0;
    if (dtMinutes <= 0.0001) dtMinutes = 0.0416;

    float depthH01 = readCalibratedWaterLevelCM(SENSOR_H01_PIN);
    float depthB17 = readCalibratedWaterLevelCM(SENSOR_B17_PIN);

    float riseRateH01 = (depthH01 - prevWaterH01) / dtMinutes;
    float riseRateB17 = (depthB17 - prevWaterB17) / dtMinutes;
    if (riseRateH01 < 0.0) riseRateH01 = 0.0;
    if (riseRateB17 < 0.0) riseRateB17 = 0.0;

    prevWaterH01 = depthH01;
    prevWaterB17 = depthB17;
    prevSampleTime = now;

    setNode1Actuators(depthH01, false, false);
    setNode2Actuators(depthB17, false, false);

    Serial.printf("[EDGE SENSORS] H01: %.2f cm (rise: %.2f/min) | B17: %.2f cm (rise: %.2f/min)\n",
                  depthH01, riseRateH01, depthB17, riseRateB17);

    StaticJsonDocument<512> doc;
    doc["device_id"] = DEVICE_ID;
    
    JsonArray readings = doc.createNestedArray("readings");

    JsonObject rH01 = readings.createNestedObject();
    rH01["sensor_id"] = "SNS-H01";
    rH01["asset_id"] = "H01";
    rH01["water_level_cm"] = serialized(String(depthH01, 2));
    rH01["rise_rate_cm_min"] = serialized(String(riseRateH01, 2));

    JsonObject rB17 = readings.createNestedObject();
    rB17["sensor_id"] = "SNS-B17";
    rB17["asset_id"] = "B17";
    rB17["water_level_cm"] = serialized(String(depthB17, 2));
    rB17["rise_rate_cm_min"] = serialized(String(riseRateB17, 2));

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      WiFiClientSecure secureClient;
      WiFiClient standardClient;

      bool isHttps = (strncmp(API_ENDPOINT, "https://", 8) == 0);
      if (isHttps) {
        secureClient.setInsecure();
        http.begin(secureClient, API_ENDPOINT);
      } else {
        http.begin(standardClient, API_ENDPOINT);
      }

      http.addHeader("Content-Type", "application/json");
      http.addHeader("Bypass-Tunnel-Reminder", "true");
      http.addHeader("bypass-tunnel-reminder", "1");
      http.setTimeout(4000);

      int httpCode = http.POST(jsonPayload);
      if (httpCode > 0) {
        String response = http.getString();
        Serial.printf("[HTTP %d] Backend Response: %s\n", httpCode, response.c_str());

        StaticJsonDocument<512> respDoc;
        DeserializationError err = deserializeJson(respDoc, response);
        if (!err) {
          bool serverBuzzer = respDoc["buzzer"] | false;
          JsonObject actuators = respDoc["actuators"];
          
          bool h01Crit = actuators["H01"]["led_critical"] | false;
          bool b17Crit = actuators["B17"]["led_critical"] | false;

          setNode1Actuators(depthH01, h01Crit, !serverBuzzer);
          setNode2Actuators(depthB17, b17Crit, !serverBuzzer);
        }
      } else {
        Serial.printf("[HTTP ERROR] Failed to send telemetry: %s\n", http.errorToString(httpCode).c_str());
      }
      http.end();
    }
  }
}
