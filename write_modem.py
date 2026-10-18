import os

target = "/Users/abhishekverma/campusGo apps/CampusGoHardware_ESP32_SIMA7672S/A7672S_Modem.cpp"

cpp_code = """#include "A7672S_Modem.h"

A7672S_Modem::A7672S_Modem() {
  _serial = nullptr;
  _rxPin = -1;
  _txPin = -1;
  _baudRate = 115200;
  _pwrKeyPin = -1;
  _rstPin = -1;
  _gnssEnabled = false;
  _netOpened = false;
  _imei = "";
  _imsi = "";
  _operatorName = "";
  _activeApn = "";
  _cachedCSQ = 0;
  _cachedSignalPercent = 0;
  _lastCSQQueryTime = 0;
}

bool A7672S_Modem::begin(HardwareSerial* serial, int rxPin, int txPin, int baudRate, int pwrKeyPin, int rstPin) {
  _serial = serial;
  _rxPin = rxPin;
  _txPin = txPin;
  _baudRate = baudRate;
  _pwrKeyPin = pwrKeyPin;
  _rstPin = rstPin;

  if (_pwrKeyPin >= 0) {
    pinMode(_pwrKeyPin, OUTPUT);
    digitalWrite(_pwrKeyPin, HIGH);
  }
  if (_rstPin >= 0) {
    pinMode(_rstPin, OUTPUT);
    digitalWrite(_rstPin, HIGH);
  }

  if (_serial) {
    _serial->begin(_baudRate, SERIAL_8N1, _rxPin, _txPin);
    _serial->setRxBufferSize(8192);
  }
  delay(200);

  // Check if modem is responsive
  if (!testAT(1000)) {
    Serial.println(F("[MODEM] No response to AT. Attempting Power Cycle..."));
    powerCycle();
    delay(2000);
  }

  // Sync AT baud
  for (int i = 0; i < 5; i++) {
    if (testAT(1500)) break;
    delay(500);
  }

  // Probe Modem Model info
  String ati = sendCommand(F("ATI"), 1500);
  ati.replace("\\r", " ");
  ati.replace("\\n", " ");
  ati.trim();
  Serial.printf("[MODEM] ATI: %s\\n", ati.c_str());

  // Configure modem basic parameters
  sendCommand(F("ATE0"));          // Echo off
  sendCommand(F("AT+CMEE=2"));      // Verbose error messages
  sendCommand(F("AT+CTZU=1"));      // Auto time zone update from network
  sendCommand(F("AT+CNMP=2"));      // Automatic Network Mode (4G LTE / 3G / 2G)
  sendCommand(F("AT+CREG=2"));      // Network registration reporting
  sendCommand(F("AT+CGREG=2"));     // GPRS registration reporting
  sendCommand(F("AT+CEREG=2"));     // EPS LTE registration reporting
  
  _imei = getIMEI();
  getSignalQuality(true);
  getOperatorName();
  Serial.printf("[MODEM] Initialized. IMEI: %s | Carrier: %s\\n", _imei.c_str(), _operatorName.c_str());

  return true;
}

void A7672S_Modem::powerCycle() {
  if (_pwrKeyPin >= 0) {
    Serial.println(F("[MODEM] Pulsing PWRKEY pin to power on..."));
    digitalWrite(_pwrKeyPin, LOW);
    delay(1200);
    digitalWrite(_pwrKeyPin, HIGH);
    delay(3000);
  }
}

void A7672S_Modem::hardReset() {
  if (_rstPin >= 0) {
    Serial.println(F("[MODEM] Hardware Resetting SIM A7672S..."));
    digitalWrite(_rstPin, LOW);
    delay(500);
    digitalWrite(_rstPin, HIGH);
    delay(3000);
  } else {
    powerCycle();
  }
}

void A7672S_Modem::flushInput() {
  if (!_serial) return;
  while (_serial->available()) {
    _serial->read();
  }
}

bool A7672S_Modem::testAT(uint32_t timeoutMs) {
  if (!_serial) return false;
  flushInput();
  _serial->println(F("AT"));
  return waitForResponse("OK", timeoutMs);
}

String A7672S_Modem::sendCommand(const String& cmd, uint32_t timeoutMs, const char* expected) {
  if (!_serial) return "";
  flushInput();
  _serial->println(cmd);
  uint32_t start = millis();
  String resp = "";
  while (millis() - start < timeoutMs) {
    while (_serial->available()) {
      char c = (char)_serial->read();
      resp += c;
    }
    if (expected && resp.indexOf(expected) != -1) {
      break;
    }
    delay(5);
  }
  return resp;
}

bool A7672S_Modem::waitForResponse(const char* expected, uint32_t timeoutMs) {
  if (!_serial) return false;
  uint32_t start = millis();
  String resp = "";
  while (millis() - start < timeoutMs) {
    while (_serial->available()) {
      char c = (char)_serial->read();
      resp += c;
      if (resp.indexOf(expected) != -1) {
        return true;
      }
    }
    delay(5);
  }
  return false;
}

String A7672S_Modem::readResponse(uint32_t timeoutMs) {
  if (!_serial) return "";
  uint32_t start = millis();
  String resp = "";
  while (millis() - start < timeoutMs) {
    while (_serial->available()) {
      char c = (char)_serial->read();
      resp += c;
    }
    if (resp.indexOf("OK") != -1 || resp.indexOf("ERROR") != -1) {
      break;
    }
    delay(5);
  }
  return resp;
}

String A7672S_Modem::getIMEI() {
  if (!_imei.isEmpty()) return _imei;
  String resp = sendCommand(F("AT+GSN"), 2000, "OK");
  int idx = resp.indexOf('\\n');
  if (idx != -1) {
    String imei = resp.substring(idx + 1);
    imei.replace("OK", "");
    imei.replace("\\r", "");
    imei.replace("\\n", "");
    imei.trim();
    if (imei.length() >= 14 && imei.length() <= 18) {
      _imei = imei;
      return _imei;
    }
  }
  return _imei;
}

String A7672S_Modem::getCCID() {
  String resp = sendCommand(F("AT+CCID"), 2000, "OK");
  int idx = resp.indexOf("+CCID:");
  if (idx != -1) {
    String ccid = resp.substring(idx + 6);
    ccid.replace("OK", "");
    ccid.replace("\\r", "");
    ccid.replace("\\n", "");
    ccid.trim();
    return ccid;
  }
  return "";
}

String A7672S_Modem::getIMSI() {
  if (!_imsi.isEmpty()) return _imsi;
  String resp = sendCommand(F("AT+CIMI"), 2000, "OK");
  int idx = resp.indexOf('\\n');
  if (idx != -1) {
    String imsi = resp.substring(idx + 1);
    imsi.replace("OK", "");
    imsi.replace("\\r", "");
    imsi.replace("\\n", "");
    imsi.trim();
    if (imsi.length() >= 10) {
      _imsi = imsi;
      return _imsi;
    }
  }
  return "";
}

String A7672S_Modem::getOperatorName() {
  if (!_operatorName.isEmpty() && _operatorName != "Unknown" && _operatorName != "Auto Detected SIM") {
    return _operatorName;
  }

  // 1. Try AT+COPS?
  String resp = sendCommand(F("AT+COPS?"), 3000, "OK");
  int q1 = resp.indexOf('\"');
  if (q1 != -1) {
    int q2 = resp.indexOf('\"', q1 + 1);
    if (q2 != -1) {
      String op = resp.substring(q1 + 1, q2);
      op.trim();
      if (!op.isEmpty()) {
        _operatorName = op;
        return _operatorName;
      }
    }
  }

  // 2. Try AT+CSPN?
  resp = sendCommand(F("AT+CSPN?"), 2000, "OK");
  q1 = resp.indexOf('\"');
  if (q1 != -1) {
    int q2 = resp.indexOf('\"', q1 + 1);
    if (q2 != -1) {
      String op = resp.substring(q1 + 1, q2);
      op.trim();
      if (!op.isEmpty()) {
        _operatorName = op;
        return _operatorName;
      }
    }
  }

  // 3. Fallback from IMSI
  String imsi = getIMSI();
  if (imsi.startsWith("40584") || imsi.startsWith("40585") || imsi.startsWith("40586") || imsi.startsWith("40587") || imsi.startsWith("40588") || imsi.startsWith("40589")) {
    _operatorName = "Jio 4G";
  } else if (imsi.startsWith("40410") || imsi.startsWith("40445") || imsi.startsWith("40470") || imsi.startsWith("40490") || imsi.startsWith("4055")) {
    _operatorName = "Airtel 4G";
  } else if (imsi.startsWith("40404") || imsi.startsWith("40420") || imsi.startsWith("40486") || imsi.startsWith("405845")) {
    _operatorName = "Vi India";
  } else if (imsi.startsWith("40434") || imsi.startsWith("40438") || imsi.startsWith("4045") || imsi.startsWith("4046")) {
    _operatorName = "BSNL 4G";
  }
  
  return _operatorName.isEmpty() ? "Auto Detected SIM" : _operatorName;
}

String A7672S_Modem::detectOptimalAPN() {
  String op = getOperatorName();
  op.toLowerCase();
  String imsi = getIMSI();

  if (op.indexOf("jio") != -1 || op.indexOf("reliance") != -1 || imsi.startsWith("4058")) {
    return "jionet";
  }
  if (op.indexOf("airtel") != -1 || op.indexOf("bharti") != -1 || imsi.startsWith("40410") || imsi.startsWith("40445") || imsi.startsWith("40470") || imsi.startsWith("40490") || imsi.startsWith("4055")) {
    return "airtelgprs.com";
  }
  if (op.indexOf("vi") != -1 || op.indexOf("vodafone") != -1 || op.indexOf("idea") != -1 || imsi.startsWith("40404") || imsi.startsWith("40420") || imsi.startsWith("40486")) {
    return "www";
  }
  if (op.indexOf("bsnl") != -1 || op.indexOf("cellone") != -1 || imsi.startsWith("40434") || imsi.startsWith("40438")) {
    return "bsnlnet";
  }
  if (op.indexOf("mtnl") != -1 || op.indexOf("dolphin") != -1) {
    return "mtnl.net";
  }
  if (op.indexOf("docomo") != -1 || op.indexOf("tata") != -1) {
    return "tatadocomo.com";
  }
  
  return "jionet";
}

String A7672S_Modem::getActiveAPN() {
  return _activeApn.isEmpty() ? "Auto" : _activeApn;
}

int A7672S_Modem::getSignalQuality(bool forceQuery) {
  if (!_serial) return 0;
  uint32_t now = millis();
  if (!forceQuery && (now - _lastCSQQueryTime < 10000) && _cachedCSQ > 0) {
    return _cachedCSQ;
  }
  _lastCSQQueryTime = now;

  String resp = sendCommand(F("AT+CSQ"), 1500, "OK");
  int idx = resp.indexOf("+CSQ:");
  if (idx != -1) {
    int comma = resp.indexOf(',', idx);
    if (comma != -1) {
      String csqStr = resp.substring(idx + 5, comma);
      csqStr.trim();
      int val = csqStr.toInt();
      _cachedCSQ = val;
      _cachedSignalPercent = (val == 99 || val < 0) ? 0 : ((val >= 31) ? 100 : (val * 100) / 31);
      return val;
    }
  }
  return _cachedCSQ;
}

int A7672S_Modem::getSignalPercent(bool forceQuery) {
  getSignalQuality(forceQuery);
  return _cachedSignalPercent;
}

bool A7672S_Modem::isSIMReady() {
  if (!_serial) return false;
  String resp = sendCommand(F("AT+CPIN?"), 2000, "OK");
  return (resp.indexOf("+CPIN: READY") != -1);
}

bool A7672S_Modem::isNetworkRegistered() {
  if (!_serial) return false;
  String resp = sendCommand(F("AT+CEREG?"), 2000, "OK");
  if (resp.indexOf(",1") != -1 || resp.indexOf(",5") != -1) return true;
  
  resp = sendCommand(F("AT+CGREG?"), 2000, "OK");
  if (resp.indexOf(",1") != -1 || resp.indexOf(",5") != -1) return true;
  
  return false;
}

bool A7672S_Modem::connectCellular(const char* apn, const char* user, const char* pass) {
  if (!_serial) return false;
  if (!isSIMReady()) {
    Serial.println(F("[MODEM] SIM not ready. Checking CPIN..."));
    delay(1000);
    if (!isSIMReady()) return false;
  }

  // Set PDP context APN
  char cmd[128];
  if (apn && strlen(apn) > 0) {
    snprintf(cmd, sizeof(cmd), "AT+CGDCONT=1,\\\"IP\\\",\\\"%s\\\"", apn);
    sendCommand(cmd, 3000, "OK");
  }

  // If user/pass specified
  if (user && strlen(user) > 0) {
    snprintf(cmd, sizeof(cmd), "AT+CGAUTH=1,1,\\\"%s\\\",\\\"%s\\\"", pass, user);
    sendCommand(cmd, 2000, "OK");
  }

  // Open Network
  String netResp = sendCommand(F("AT+NETOPEN"), 5000);
  if (netResp.indexOf("OK") != -1 || netResp.indexOf("+NETOPEN: 0") != -1 || netResp.indexOf("Network is already opened") != -1) {
    _netOpened = true;
    _activeApn = (apn && strlen(apn) > 0) ? String(apn) : "Auto/Default";
    Serial.printf("[MODEM] 4G LTE Data Network Connected (APN: %s)!\\n", _activeApn.c_str());
    getSignalQuality(true);
    return true;
  }

  // Query IP
  String ipResp = sendCommand(F("AT+IPADDR"), 3000);
  if (ipResp.indexOf("+IPADDR:") != -1) {
    _netOpened = true;
    _activeApn = (apn && strlen(apn) > 0) ? String(apn) : "Auto/Default";
    return true;
  }

  return false;
}

bool A7672S_Modem::connectCellularAuto(const char* preferredApn) {
  if (!_serial) return false;
  if (!isSIMReady()) {
    Serial.println(F("[MODEM] SIM not ready. Checking CPIN..."));
    for (int c = 0; c < 5; c++) {
      delay(1000);
      if (isSIMReady()) break;
    }
    if (!isSIMReady()) return false;
  }

  // Identify inserted SIM
  String detectedCarrier = getOperatorName();
  String optimalApn = detectOptimalAPN();
  Serial.printf("[MODEM] SIM Operator Detected: '%s' | Recommended APN: '%s'\\n", detectedCarrier.c_str(), optimalApn.c_str());

  // Build candidate APNs prioritized list
  const char* apnCandidates[10];
  int count = 0;

  if (preferredApn && strlen(preferredApn) > 0) {
    apnCandidates[count++] = preferredApn;
  }
  if (!optimalApn.isEmpty()) {
    bool exists = false;
    for (int k = 0; k < count; k++) {
      if (optimalApn.equalsIgnoreCase(apnCandidates[k])) exists = true;
    }
    if (!exists) {
      if (optimalApn == "jionet") apnCandidates[count++] = "jionet";
      else if (optimalApn == "airtelgprs.com") apnCandidates[count++] = "airtelgprs.com";
      else if (optimalApn == "www") apnCandidates[count++] = "www";
      else if (optimalApn == "bsnlnet") apnCandidates[count++] = "bsnlnet";
      else if (optimalApn == "mtnl.net") apnCandidates[count++] = "mtnl.net";
      else if (optimalApn == "tatadocomo.com") apnCandidates[count++] = "tatadocomo.com";
      else apnCandidates[count++] = "jionet";
    }
  }

  const char* allCommonApns[] = { "jionet", "airtelgprs.com", "www", "bsnlnet", "internet", "portalnmms", "" };
  for (const char* stdApn : allCommonApns) {
    if (count >= 10) break;
    bool exists = false;
    for (int k = 0; k < count; k++) {
      if (strcasecmp(stdApn, apnCandidates[k]) == 0) exists = true;
    }
    if (!exists) apnCandidates[count++] = stdApn;
  }

  // Wait for Cellular Registration
  for (int i = 0; i < 15; i++) {
    if (isNetworkRegistered()) break;
    Serial.printf("[MODEM] Waiting for cellular registration (%d/15)...\\n", i + 1);
    delay(1200);
  }

  // Try APNs
  for (int i = 0; i < count; i++) {
    Serial.printf("[CELLULAR] Trying APN '%s' (%d/%d)...\\n", apnCandidates[i], i + 1, count);
    if (connectCellular(apnCandidates[i], "", "")) {
      return true;
    }
    delay(300);
  }

  return false;
}

bool A7672S_Modem::isNetworkOpen() {
  if (!_serial) return false;
  String resp = sendCommand(F("AT+NETOPEN?"), 2000, "OK");
  return (resp.indexOf("+NETOPEN: 1") != -1);
}

void A7672S_Modem::closeNetwork() {
  if (!_serial) return;
  sendCommand(F("AT+NETCLOSE"), 3000);
  _netOpened = false;
}

// ==============================================================================
// GNSS (GPS) ENGINE FOR SIM A7672S-FASE
// ==============================================================================
bool A7672S_Modem::enableGNSS() {
  if (!_serial) return false;

  // 1. Enable VAUX Active Antenna LNA Bias Power (3.3V)
  sendCommand(F("AT+CVAUXS=1"), 1000);
  sendCommand(F("AT+CVAUXV=3300"), 1000);

  // 2. Power on GNSS Engine
  sendCommand(F("AT+CGNSSPWR=1"), 3000, "OK");
  
  // 3. Set Constellation Mode
  sendCommand(F("AT+CGNSSMODE=15"), 1000);
  sendCommand(F("AT+CGNSSMODE=7"), 1000);
  sendCommand(F("AT+CGNSSMODE=3"), 1000);

  // 4. Ensure NMEA stream is not jamming AT port
  sendCommand(F("AT+CGNSSTST=0"), 1000);
  sendCommand(F("AT+CGNSSNMEA=1"), 1000);

  // 5. Try enabling AGPS for fast cold-start TTFF
  sendCommand(F("AT+CGNSSAGPS=1"), 1000);

  _gnssEnabled = true;
  Serial.println(F("[GNSS] GNSS Engine Powered ON & Ready."));
  return true;
}

bool A7672S_Modem::disableGNSS() {
  if (!_serial) return false;
  sendCommand(F("AT+CGNSSPWR=0"), 3000);
  _gnssEnabled = false;
  return true;
}

double A7672S_Modem::parseNmeaCoord(const String& rawVal, char dir) {
  if (rawVal.length() < 4) return 0.0;
  
  int dotIdx = rawVal.indexOf('.');
  if (dotIdx == -1) return 0.0;

  int degDigits = (dotIdx >= 5) ? 3 : 2;

  double degrees = rawVal.substring(0, degDigits).toDouble();
  double minutes = rawVal.substring(degDigits).toDouble();
  double decimal = degrees + (minutes / 60.0);

  if (dir == 'S' || dir == 'W') {
    decimal = -decimal;
  }
  return decimal;
}

String A7672S_Modem::formatISTTime(const String& utcTimeStr, const String& dateStr) {
  if (utcTimeStr.length() < 6) return "--:--";

  int hour = utcTimeStr.substring(0, 2).toInt();
  int min  = utcTimeStr.substring(2, 4).toInt();
  int sec  = utcTimeStr.substring(4, 6).toInt();

  // Convert UTC to IST (+5 hours 30 mins)
  min += 30;
  if (min >= 60) {
    min -= 60;
    hour += 1;
  }
  hour += 5;
  if (hour >= 24) {
    hour -= 24;
  }

  // Format 12-hour AM/PM
  String ampm = (hour >= 12) ? "PM" : "AM";
  int hour12 = hour % 12;
  if (hour12 == 0) hour12 = 12;

  char buf[32];
  snprintf(buf, sizeof(buf), "%02d:%02d:%02d %s", hour12, min, sec, ampm.c_str());
  return String(buf);
}

bool A7672S_Modem::getGNSSLocation(GPSData& gps) {
  gps.valid = false;
  if (!_serial) return false;
  if (!_gnssEnabled) {
    enableGNSS();
  }

  // Query AT+CGNSSINFO?
  String resp = sendCommand(F("AT+CGNSSINFO?"), 1200);
  int idx = resp.indexOf("+CGNSSINFO:");
  
  if (idx == -1) {
    resp = sendCommand(F("AT+CGPSINFO?"), 1200);
    idx = resp.indexOf("+CGPSINFO:");
  }

  static uint32_t lastRawLog = 0;
  if (millis() - lastRawLog > 2500) {
    lastRawLog = millis();
    String cleanResp = resp;
    cleanResp.replace("\\r", " ");
    cleanResp.replace("\\n", " ");
    cleanResp.trim();
    Serial.printf("[GNSS] Live Query: '%s'\\n", cleanResp.c_str());
  }

  if (idx == -1) return false;

  int colonIdx = resp.indexOf(':', idx);
  String line = (colonIdx != -1) ? resp.substring(colonIdx + 1) : resp.substring(idx + 11);
  line.replace("\\r", "");
  line.replace("\\n", "");
  line.replace("OK", "");
  line.trim();

  // Handle +CGNSSINFO: 0 (No fix / searching satellites)
  if (line == "0" || line.startsWith("0,") || line.startsWith(",,,,,") || line.length() < 6) {
    gps.satellites = 0;
    return false;
  }

  String fields[16];
  int fieldIndex = 0;
  int lastPos = 0;
  for (int i = 0; i < line.length() && fieldIndex < 16; i++) {
    if (line.charAt(i) == ',') {
      fields[fieldIndex++] = line.substring(lastPos, i);
      lastPos = i + 1;
    }
  }
  if (fieldIndex < 16 && lastPos <= line.length()) {
    fields[fieldIndex++] = line.substring(lastPos);
  }

  // Extract satellite counts
  int gpsSVs = (fieldIndex > 1) ? fields[1].toInt() : 0;
  int gloSVs = (fieldIndex > 2) ? fields[2].toInt() : 0;
  int bduSVs = (fieldIndex > 3) ? fields[3].toInt() : 0;
  gps.satellites = gpsSVs + gloSVs + bduSVs;

  String mode = (fieldIndex > 0) ? fields[0] : "0";
  mode.trim();

  // Mode 2 = 2D fix, Mode 3 = 3D fix
  if (mode != "2" && mode != "3") {
    return false;
  }

  if (fieldIndex < 12) return false;

  String rawLat = fields[4]; rawLat.trim();
  String latDir = fields[5]; latDir.trim();
  String rawLon = fields[6]; rawLon.trim();
  String lonDir = fields[7]; lonDir.trim();
  String date   = fields[8]; date.trim();
  String utc    = fields[9]; utc.trim();
  String alt    = fields[10]; alt.trim();
  String spdKnots = fields[11]; spdKnots.trim();
  String course   = (fieldIndex > 12) ? fields[12] : "0.0"; course.trim();
  String hdop     = (fieldIndex > 14) ? fields[14] : "1.0"; hdop.trim();

  if (rawLat.isEmpty() || rawLon.isEmpty()) return false;

  gps.lat = parseNmeaCoord(rawLat, latDir.length() > 0 ? latDir.charAt(0) : 'N');
  gps.lng = parseNmeaCoord(rawLon, lonDir.length() > 0 ? lonDir.charAt(0) : 'E');

  if (gps.lat == 0.0 && gps.lng == 0.0) return false;

  double knots = spdKnots.toDouble();
  double speedKmh = knots * 1.852;
  gps.speedKmh = (speedKmh < 0.8) ? 0.0 : (float)speedKmh;

  gps.bearing = course.toFloat();
  gps.altitude = alt.toFloat();
  gps.hdop = hdop.toFloat();
  gps.accuracy = (int)(gps.hdop * 3.5);
  if (gps.accuracy < 3) gps.accuracy = 3;

  gps.date = date;
  gps.utcTime = utc;
  gps.timeString = formatISTTime(utc, date);
  gps.epochTime = millis() / 1000;
  gps.valid = true;

  Serial.printf("[GNSS] >>> 3D FIX ACQUIRED! Lat: %.6f, Lng: %.6f | Sats: %d (GPS:%d, GLO:%d, BDS:%d) | Speed: %.1f km/h | Time: %s <<<\\n",
                gps.lat, gps.lng, gps.satellites, gpsSVs, gloSVs, bduSVs, gps.speedKmh, gps.timeString.c_str());

  return true;
}

// ==============================================================================
// HTTP / HTTPS REST API CLIENT WITH COMPLETE STREAM DRAINING
// ==============================================================================
int A7672S_Modem::executeHttpRequest(int actionCode, const String& url, const String& payload, String& response, uint32_t timeoutMs) {
  response = "";
  if (!_serial) return -1;

  sendCommand(F("AT+HTTPTERM"), 500);
  flushInput();

  // Configure SSL Context for HTTPS
  bool isHttps = url.startsWith("https://");
  if (isHttps) {
    sendCommand(F("AT+CSSLCFG=\\\"sslversion\\\",0,4"), 1000, "OK"); // TLS 1.2
    sendCommand(F("AT+CSSLCFG=\\\"authmode\\\",0,0"), 1000, "OK");   // No client cert validation
    sendCommand(F("AT+CSSLCFG=\\\"ignorelocaltime\\\",0,1"), 1000, "OK");
  }

  String initResp = sendCommand(F("AT+HTTPINIT"), 2000, "OK");
  if (initResp.indexOf("OK") == -1) {
    Serial.println(F("[HTTP] HTTPINIT failed"));
    return -1;
  }

  if (isHttps) {
    sendCommand(F("AT+HTTPPARA=\\\"SSLCFG\\\",0"), 1500, "OK");
  }

  String urlCmd = "AT+HTTPPARA=\\\"URL\\\",\\\"" + url + "\\\"";
  sendCommand(urlCmd, 2000, "OK");
  sendCommand(F("AT+HTTPPARA=\\\"CONTENT\\\",\\\"application/json\\\""), 1500, "OK");
  sendCommand(F("AT+HTTPPARA=\\\"TIMEOUT\\\",15"), 1500, "OK");

  if ((actionCode == 1 || actionCode == 2 || actionCode == 4) && payload.length() > 0) {
    String dataCmd = "AT+HTTPDATA=" + String(payload.length()) + ",10000";
    flushInput();
    _serial->println(dataCmd);

    if (waitForResponse("DOWNLOAD", 3000) || waitForResponse(">", 2000)) {
      _serial->print(payload);
      waitForResponse("OK", 4000);
    } else {
      Serial.println(F("[HTTP] HTTPDATA prompt failed"));
      sendCommand(F("AT+HTTPTERM"), 500);
      return -2;
    }
  }

  String actionCmd = "AT+HTTPACTION=" + String(actionCode);
  flushInput();
  _serial->println(actionCmd);

  uint32_t start = millis();
  int statusCode = -1;
  int dataLen = 0;

  while (millis() - start < timeoutMs) {
    if (_serial->available()) {
      String line = _serial->readStringUntil('\\n');
      int actIdx = line.indexOf("+HTTPACTION:");
      if (actIdx != -1) {
        String params = line.substring(actIdx + 12);
        params.trim();
        int firstComma = params.indexOf(',');
        if (firstComma != -1) {
          int secondComma = params.indexOf(',', firstComma + 1);
          if (secondComma != -1) {
            statusCode = params.substring(firstComma + 1, secondComma).toInt();
            dataLen = params.substring(secondComma + 1).toInt();
          } else {
            statusCode = params.substring(firstComma + 1).toInt();
          }
        }
        break;
      }
    }
    delay(5);
  }

  // Read response payload if present
  if (statusCode > 0 && dataLen > 0) {
    flushInput();
    _serial->println("AT+HTTPREAD=0," + String(dataLen));

    uint32_t rStart = millis();
    String raw = "";
    while (millis() - rStart < 4000) {
      while (_serial->available()) {
        raw += (char)_serial->read();
      }
      if (raw.indexOf("OK") != -1 && raw.indexOf("+HTTPREAD:") != -1) {
        delay(30);
        while (_serial->available()) raw += (char)_serial->read();
        break;
      }
      delay(5);
    }

    int dataIdx = raw.indexOf("+HTTPREAD:");
    if (dataIdx != -1) {
      int nl = raw.indexOf('\\n', dataIdx);
      if (nl != -1) {
        response = raw.substring(nl + 1);
        int readEnd = response.indexOf("+HTTPREAD:");
        if (readEnd != -1) {
          response = response.substring(0, readEnd);
        }
        int okIdx = response.lastIndexOf("OK");
        if (okIdx != -1) {
          response = response.substring(0, okIdx);
        }
        response.replace("OK", "");
        response.replace("\\r", "");
        response.trim();
        
        int jsonStart = response.indexOf('{');
        int jsonEnd = response.lastIndexOf('}');
        if (jsonStart != -1 && jsonEnd != -1 && jsonEnd >= jsonStart) {
          response = response.substring(jsonStart, jsonEnd + 1);
        }
      }
    }
  }

  sendCommand(F("AT+HTTPTERM"), 1000);
  flushInput();
  return statusCode;
}

int A7672S_Modem::httpGet(const String& url, String& responsePayload, uint32_t timeoutMs) {
  return executeHttpRequest(0, url, "", responsePayload, timeoutMs);
}

int A7672S_Modem::httpPost(const String& url, const String& jsonPayload, String& responsePayload, uint32_t timeoutMs) {
  return executeHttpRequest(1, url, jsonPayload, responsePayload, timeoutMs);
}

int A7672S_Modem::httpPut(const String& url, const String& jsonPayload, String& responsePayload, uint32_t timeoutMs) {
  return executeHttpRequest(4, url, jsonPayload, responsePayload, timeoutMs);
}

int A7672S_Modem::httpPatch(const String& url, const String& jsonPayload, String& responsePayload, uint32_t timeoutMs) {
  return executeHttpRequest(4, url, jsonPayload, responsePayload, timeoutMs);
}

int A7672S_Modem::httpDelete(const String& url, uint32_t timeoutMs) {
  String dummy = "";
  return executeHttpRequest(5, url, "", dummy, timeoutMs);
}
"""

with open(target, "w") as f:
    f.write(cpp_code)
print("File written cleanly.")
