/**
 * URL Validator with SSRF Protection
 * Blocks requests to private/internal networks and validates protocols
 */

// Private IP ranges that should be blocked
const PRIVATE_IP_PATTERNS = [
  /^127\./,                          // Loopback (127.0.0.0/8)
  /^10\./,                           // Class A private (10.0.0.0/8)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Class B private (172.16.0.0/12)
  /^192\.168\./,                     // Class C private (192.168.0.0/16)
  /^169\.254\./,                     // Link-local (169.254.0.0/16)
  /^0\./,                            // Current network (0.0.0.0/8)
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT (100.64.0.0/10)
  /^192\.0\.0\./,                    // IETF Protocol Assignments (192.0.0.0/24)
  /^192\.0\.2\./,                    // TEST-NET-1 (192.0.2.0/24)
  /^198\.51\.100\./,                 // TEST-NET-2 (198.51.100.0/24)
  /^203\.0\.113\./,                  // TEST-NET-3 (203.0.113.0/24)
  /^224\./,                          // Multicast (224.0.0.0/4)
  /^240\./,                          // Reserved (240.0.0.0/4)
  /^255\.255\.255\.255$/,            // Broadcast
];

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '[::]',
  '[::1]',
  'metadata.google.internal',        // GCP metadata
  'metadata.google',
  '169.254.169.254',                 // AWS/Azure/GCP metadata endpoint
];

// Allowed protocols
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Custom error class for URL validation failures
 */
export class UrlValidationError extends Error {
  constructor(message, code = 'URL_VALIDATION_ERROR') {
    super(message);
    this.name = 'UrlValidationError';
    this.code = code;
  }
}

/**
 * Check if an IP address is private/internal
 * @param {string} ip - IP address to check
 * @returns {boolean} - True if IP is private
 */
function isPrivateIP(ip) {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(ip));
}

/**
 * Check if hostname is blocked
 * @param {string} hostname - Hostname to check
 * @returns {boolean} - True if hostname is blocked
 */
function isBlockedHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return BLOCKED_HOSTNAMES.some(blocked =>
    normalized === blocked || normalized.endsWith('.' + blocked)
  );
}

/**
 * Check if hostname looks like an IP address
 * @param {string} hostname - Hostname to check
 * @returns {boolean} - True if hostname is an IP address
 */
function isIPAddress(hostname) {
  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  // IPv6 (with or without brackets)
  if (hostname.startsWith('[') || hostname.includes(':')) {
    return true;
  }
  return false;
}

/**
 * Validate a URL for SSRF protection
 * @param {string} urlString - URL to validate
 * @returns {{ url: URL, isValid: true }} - Parsed URL object if valid
 * @throws {UrlValidationError} - If URL is invalid or blocked
 */
export function validateUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    throw new UrlValidationError('URL is required', 'MISSING_URL');
  }

  // Trim whitespace
  urlString = urlString.trim();

  // Parse URL
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (e) {
    throw new UrlValidationError(`Invalid URL format: ${urlString}`, 'INVALID_FORMAT');
  }

  // Check protocol
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new UrlValidationError(
      `Invalid protocol: ${parsed.protocol}. Only HTTP and HTTPS are allowed.`,
      'INVALID_PROTOCOL'
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check blocked hostnames
  if (isBlockedHostname(hostname)) {
    throw new UrlValidationError(
      `Blocked hostname: ${hostname}`,
      'BLOCKED_HOSTNAME'
    );
  }

  // Check if hostname is an IP address and if it's private
  if (isIPAddress(hostname)) {
    // Remove brackets for IPv6
    const ip = hostname.replace(/^\[|\]$/g, '');

    if (isPrivateIP(ip)) {
      throw new UrlValidationError(
        `Private IP addresses are not allowed: ${ip}`,
        'PRIVATE_IP'
      );
    }
  }

  // Block URLs with credentials (user:pass@host)
  if (parsed.username || parsed.password) {
    throw new UrlValidationError(
      'URLs with credentials are not allowed',
      'CREDENTIALS_NOT_ALLOWED'
    );
  }

  return { url: parsed, isValid: true };
}

/**
 * Validate URL and return boolean (non-throwing version)
 * @param {string} urlString - URL to validate
 * @returns {boolean} - True if URL is valid and safe
 */
export function isValidUrl(urlString) {
  try {
    validateUrl(urlString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate an array of URLs
 * @param {string[]} urls - Array of URLs to validate
 * @returns {{ valid: string[], invalid: { url: string, error: string }[] }}
 */
export function validateUrls(urls) {
  const valid = [];
  const invalid = [];

  for (const url of urls) {
    try {
      validateUrl(url);
      valid.push(url);
    } catch (e) {
      invalid.push({ url, error: e.message });
    }
  }

  return { valid, invalid };
}
