/*
 * ORACLE Edge - ESP32 Hardware Node Firmware v1.0
 * Compliant with PRD Section 10 (Hardware Requirements & Edge-to-Cloud Transport)
 *
 * Hardware Pin Connections:
 * - Ultrasonic Sensor (HC-SR04 / JSN-SR04T):
 *     TRIG_PIN -> GPIO 5
 *     ECHO_PIN -> GPIO 18
 * - Rain Sensor (Capacitive/Resistive):
 *     RAIN_DIGITAL_PIN -> GPIO 19
 *     RAIN_ANALOG_PIN  -> GPIO 34 (ADC1)
 * - Actuators (Physical Alert Loop PRD 5.1 & 10.1):
 *     BUZZER_PIN -> GPIO 21
 *     RED_LED_PIN -> GPIO 22
 *     STATUS_LED_PIN -> GPIO 2 (Onboard LED)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Cloud API Configuration (FastAPI Backend)
const char* ORACLE_API_ENDPOINT = "http://192.168.1.100:8000/api/v1/sensors/readings";
const char* DEVICE_ID = "ORACLE-001"; // Assigned to Bridge B17

// Pin Definitions
#define TRIG_PIN 5
#define ECHO_PIN 18
#define RAIN_DIG_PIN 19
#define RAIN_ANA_PIN 34
#define BUZZER_PIN 21
#define RED_LED_PIN 22
#define STATUS_LED_PIN 2

// Telemetry State
float previousWaterLevel = 20.0;
unsigned long previousSampleTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 5000; // 5 seconds in demo mode

// Sound buzzer alarm pattern
void triggerAlarm(bool enable) {
  if (enable) {
    digitalWrite(RED_LED_PIN, HIGH);
    tone(BUZZER_PIN, 2400); // 2.4 kHz alarm pitch
  } else {
    digitalWrite(RED_LED_PIN, LOW);
    noTone(BUZZER_PIN);
  }
}

float measureWaterLevelCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  if (duration == 0) {
    return previousWaterLevel; // Maintain last reading if echo timeout
  }
  // Distance in cm = duration * 0.034 / 2
  float distance = duration * 0.034 / 2.0;
  
  // Ultrasonic is typically mounted above the channel (e.g. 120cm above stream bed)
  // Water level = Total Height (120cm) - Measured Distance
  float waterLevel = 120.0 - distance;
  if (waterLevel < 0) waterLevel = 0.0;
  return waterLevel;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("=========================================");
  Serial.println(" ORACLE Edge Node v1.0 Booting...");
  Serial.println(" Space-to-Ground Infrastructure Sentinel");
  Serial.println("=========================================");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RAIN_DIG_PIN, INPUT);
  pinMode(RAIN_ANA_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);

  triggerAlarm(false);

  // WiFi Connection
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[CONNECTED] IP Address: " + WiFi.localIP().toString());
    digitalWrite(STATUS_LED_PIN, HIGH);
  } else {
    Serial.println("\n[WARN] WiFi not connected. Running in offline / bench test mode.");
  }

  previousSampleTime = millis();
}

void loop() {
  unsigned long currentTime = millis();
  if (currentTime - previousSampleTime >= TELEMETRY_INTERVAL_MS) {
    float elapsedTimeMinutes = (currentTime - previousSampleTime) / 60000.0;
    if (elapsedTimeMinutes <= 0) elapsedTimeMinutes = 0.01;

    // 1. Read Sensors
    float currentWaterLevel = measureWaterLevelCM();
    float riseRate = (currentWaterLevel - previousWaterLevel) / elapsedTimeMinutes;
    
    // Rain sensor: Low on digital pin indicates water contact
    bool rainDetected = (digitalRead(RAIN_DIG_PIN) == LOW);
    int rainRawAnalog = analogRead(RAIN_ANA_PIN);
    float estimated1hRain = rainDetected ? map(4095 - rainRawAnalog, 0, 4095, 10, 60) : 0.0;

    previousWaterLevel = currentWaterLevel;
    previousSampleTime = currentTime;

    // 2. Build JSON Telemetry Payload (PRD 10.3)
    StaticJsonDocument<300> doc;
    doc["device_id"] = DEVICE_ID;
    doc["water_level_cm"] = serialized(String(currentWaterLevel, 1));
    doc["water_rise_rate_cm_min"] = serialized(String(riseRate, 2));
    doc["rain_detected"] = rainDetected;
    doc["rainfall_1h_mm"] = serialized(String(estimated1hRain, 1));
    doc["battery_voltage"] = 4.12;

    String jsonPayload;
    serializeJson(doc, jsonPayload);
    Serial.println("[TELEMETRY] " + jsonPayload);

    // 3. Transmit to Cloud API
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(ORACLE_API_ENDPOINT);
      http.addHeader("Content-Type", "application/json");

      int httpResponseCode = http.POST(jsonPayload);
      if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.printf("[HTTP %d] Response: %s\n", httpResponseCode, response.c_str());

        // 4. Parse Decision Feedback & Physical Alert Loop (PRD 5.1 & 16)
        StaticJsonDocument<400> respDoc;
        DeserializationError err = deserializeJson(respDoc, response);
        if (!err) {
          bool alertTriggered = respDoc["physical_alert_triggered"] | false;
          const char* riskLevel = respDoc["risk_level"] | "LOW";

          if (alertTriggered) {
            Serial.printf("[ALERT] !!! CRITICAL STATE DETECTED (%s) !!! Activating Buzzer & Beacon\n", riskLevel);
            triggerAlarm(true);
            delay(1200);
            triggerAlarm(false);
          } else {
            triggerAlarm(false);
          }
        }
      } else {
        Serial.printf("[ERROR] HTTP POST failed, error: %s\n", http.errorToString(httpResponseCode).c_str());
      }
      http.end();
    }
  }
}
