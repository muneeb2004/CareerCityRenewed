/**
 * URL Validator & SSRF Prevention
 * OWASP A10:2021 - Server-Side Request Forgery
 * 
 * Provides comprehensive URL validation to prevent SSRF attacks:
 * - Domain whitelist/blacklist
 * - Private IP range blocking
 * - Protocol validation
 * - URL parsing and sanitization
 */

import { logSuspiciousActivity } from './security-logger';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Allowed domains for external requests
 * Add your trusted external services here
 */
const ALLOWED_DOMAINS: string[] = [
  // Add your trusted domains
  // 'api.example.com',
  // 'cdn.example.com',
];

/**
 * Blocked domains (known malicious or internal)
 */
const BLOCKED_DOMAINS: string[] = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  'metadata.google.internal',
  '169.254.169.254', // AWS/GCP metadata
  'metadata.azure.com',
];

/**
 * Allowed protocols
 */
const ALLOWED_PROTOCOLS: string[] = ['https:', 'http:'];

/**
 * Strict mode - only allow explicitly whitelisted domains
 */
const STRICT_MODE = process.env.URL_VALIDATOR_STRICT_MODE === 'true';

// =============================================================================
// Types
// =============================================================================

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  sanitizedUrl?: string;
  details?: {
    protocol?: string;
    hostname?: string;
    port?: string;
    pathname?: string;
    blockedReason?: string;
  };
}

export interface UrlValidatorOptions {
  allowHttp?: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowPrivateIps?: boolean;
  allowLocalhost?: boolean;
  maxRedirects?: number;
  timeout?: number;
}

// =============================================================================
// Private IP Detection
// =============================================================================

/**
 * IPv4 private ranges
 */
const PRIVATE_IPV4_RANGES = [
  // 10.0.0.0 - 10.255.255.255 (Class A)
  { start: '10.0.0.0', end: '10.255.255.255' },
  // 172.16.0.0 - 172.31.255.255 (Class B)
  { start: '172.16.0.0', end: '172.31.255.255' },
  // 192.168.0.0 - 192.168.255.255 (Class C)
  { start: '192.168.0.0', end: '192.168.255.255' },
  // 127.0.0.0 - 127.255.255.255 (Loopback)
  { start: '127.0.0.0', end: '127.255.255.255' },
  // 169.254.0.0 - 169.254.255.255 (Link-local)
  { start: '169.254.0.0', end: '169.254.255.255' },
  // 0.0.0.0 - 0.255.255.255 (Current network)
  { start: '0.0.0.0', end: '0.255.255.255' },
];

/**
 * Convert IPv4 address to numeric value for comparison
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Check if an IPv4 address is in a private range
 */
function isPrivateIPv4(ip: string): boolean {
  // Validate IPv4 format
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);
  
  if (!match) {
    return false;
  }
  
  // Check each octet is valid
  const octets = match.slice(1).map(Number);
  if (octets.some(o => o > 255)) {
    return false;
  }
  
  const ipNum = ipToNumber(ip);
  
  for (const range of PRIVATE_IPV4_RANGES) {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    
    if (ipNum >= startNum && ipNum <= endNum) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if an IPv6 address is private/local
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  
  // Loopback
  if (normalized === '::1' || normalized === '[::1]') {
    return true;
  }
  
  // Link-local (fe80::/10)
  if (normalized.startsWith('fe80:') || normalized.startsWith('[fe80:')) {
    return true;
  }
  
  // Unique local (fc00::/7 - fd00::/8)
  if (normalized.startsWith('fc') || normalized.startsWith('fd') ||
      normalized.startsWith('[fc') || normalized.startsWith('[fd')) {
    return true;
  }
  
  // IPv4-mapped IPv6
  if (normalized.startsWith('::ffff:') || normalized.startsWith('[::ffff:')) {
    const ipv4Part = normalized.replace(/^\[?::ffff:/i, '').replace(/\]$/, '');
    return isPrivateIPv4(ipv4Part);
  }
  
  return false;
}

/**
 * Check if a hostname is an IP address (v4 or v6)
 */
function isIpAddress(hostname: string): boolean {
  // IPv4
  if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(hostname)) {
    return true;
  }
  
  // IPv6 (with or without brackets)
  if (/^\[?([0-9a-fA-F:]+)\]?$/.test(hostname)) {
    return true;
  }
  
  return false;
}

/**
 * Check if a hostname/IP is private
 */
export function isPrivateAddress(hostname: string): boolean {
  // Remove brackets from IPv6
  const cleanHostname = hostname.replace(/^\[|\]$/g, '');
  
  // Check if it's an IP address
  if (isIpAddress(cleanHostname)) {
    if (cleanHostname.includes(':')) {
      return isPrivateIPv6(cleanHostname);
    }
    return isPrivateIPv4(cleanHostname);
  }
  
  // Check for localhost variants
  const lowercaseHost = cleanHostname.toLowerCase();
  if (lowercaseHost === 'localhost' || 
      lowercaseHost.endsWith('.localhost') ||
      lowercaseHost.endsWith('.local')) {
    return true;
  }
  
  return false;
}

// =============================================================================
// Domain Validation
// =============================================================================

/**
 * Check if a domain is in the allowed list
 */
function isDomainAllowed(hostname: string, allowedDomains?: string[]): boolean {
  const domains = allowedDomains || ALLOWED_DOMAINS;
  
  if (domains.length === 0 && !STRICT_MODE) {
    return true; // No whitelist configured and not in strict mode
  }
  
  const lowercaseHost = hostname.toLowerCase();
  
  return domains.some(domain => {
    const lowercaseDomain = domain.toLowerCase();
    return lowercaseHost === lowercaseDomain || 
           lowercaseHost.endsWith(`.${lowercaseDomain}`);
  });
}

/**
 * Check if a domain is in the blocked list
 */
function isDomainBlocked(hostname: string, blockedDomains?: string[]): boolean {
  const domains = [...BLOCKED_DOMAINS, ...(blockedDomains || [])];
  const lowercaseHost = hostname.toLowerCase();
  
  return domains.some(domain => {
    const lowercaseDomain = domain.toLowerCase();
    return lowercaseHost === lowercaseDomain || 
           lowercaseHost.endsWith(`.${lowercaseDomain}`);
  });
}

// =============================================================================
// URL Validation
// =============================================================================

/**
 * Validate a URL for safe external requests
 */
export function validateUrl(
  url: string,
  options: UrlValidatorOptions = {}
): UrlValidationResult {
  const {
    allowHttp = false,
    allowedDomains,
    blockedDomains,
    allowPrivateIps = false,
    allowLocalhost = false,
  } = options;
  
  // Parse URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format',
      details: { blockedReason: 'parse_error' },
    };
  }
  
  // Check protocol
  const allowedProtocols = allowHttp ? ALLOWED_PROTOCOLS : ['https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      valid: false,
      error: `Protocol not allowed: ${parsed.protocol}`,
      details: {
        protocol: parsed.protocol,
        blockedReason: 'protocol_not_allowed',
      },
    };
  }
  
  // Check for blocked domains
  if (isDomainBlocked(parsed.hostname, blockedDomains)) {
    return {
      valid: false,
      error: 'Domain is blocked',
      details: {
        hostname: parsed.hostname,
        blockedReason: 'domain_blocked',
      },
    };
  }
  
  // Check for private/internal addresses
  if (!allowPrivateIps && isPrivateAddress(parsed.hostname)) {
    // Check localhost exception
    if (allowLocalhost && 
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      // Allowed
    } else {
      return {
        valid: false,
        error: 'Private IP addresses are not allowed',
        details: {
          hostname: parsed.hostname,
          blockedReason: 'private_ip',
        },
      };
    }
  }
  
  // Check domain whitelist (if configured or in strict mode)
  if (STRICT_MODE || (allowedDomains && allowedDomains.length > 0)) {
    if (!isDomainAllowed(parsed.hostname, allowedDomains)) {
      return {
        valid: false,
        error: 'Domain not in allowed list',
        details: {
          hostname: parsed.hostname,
          blockedReason: 'domain_not_allowed',
        },
      };
    }
  }
  
  // Build sanitized URL (removes credentials, normalizes)
  const sanitizedUrl = `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}${parsed.pathname}${parsed.search}`;
  
  return {
    valid: true,
    sanitizedUrl,
    details: {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      pathname: parsed.pathname,
    },
  };
}

/**
 * Quick check if a URL is safe (returns boolean)
 */
export function isUrlSafe(url: string, options?: UrlValidatorOptions): boolean {
  return validateUrl(url, options).valid;
}

// =============================================================================
// Safe Fetch Wrapper
// =============================================================================

/**
 * Safe fetch that validates URLs before making requests
 */
export async function safeFetch(
  url: string,
  init?: RequestInit,
  validatorOptions?: UrlValidatorOptions
): Promise<Response> {
  // Validate URL
  const validation = validateUrl(url, validatorOptions);
  
  if (!validation.valid) {
    // Log suspicious activity
    await logSuspiciousActivity(
      `Blocked SSRF attempt: ${validation.error}`,
      {
        url: url.slice(0, 200), // Truncate for safety
        reason: validation.details?.blockedReason,
        hostname: validation.details?.hostname,
      }
    );
    
    throw new Error(`URL validation failed: ${validation.error}`);
  }
  
  // Use sanitized URL
  const safeUrl = validation.sanitizedUrl!;
  
  // Add timeout if not specified
  const controller = new AbortController();
  const timeout = validatorOptions?.timeout || 30000; // 30 seconds default
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(safeUrl, {
      ...init,
      signal: controller.signal,
      redirect: 'manual', // Prevent automatic redirects for security
    });
    
    // Check for redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        // Validate redirect URL
        const redirectValidation = validateUrl(location, validatorOptions);
        if (!redirectValidation.valid) {
          throw new Error(`Redirect URL validation failed: ${redirectValidation.error}`);
        }
      }
    }
    
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Safe fetch with automatic redirect following (with validation)
 */
export async function safeFetchWithRedirects(
  url: string,
  init?: RequestInit,
  validatorOptions?: UrlValidatorOptions
): Promise<Response> {
  const maxRedirects = validatorOptions?.maxRedirects ?? 5;
  let currentUrl = url;
  let redirectCount = 0;
  
  while (redirectCount < maxRedirects) {
    const response = await safeFetch(currentUrl, init, validatorOptions);
    
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return response;
      }
      
      // Resolve relative URLs
      currentUrl = new URL(location, currentUrl).toString();
      redirectCount++;
    } else {
      return response;
    }
  }
  
  throw new Error(`Too many redirects (max: ${maxRedirects})`);
}

// =============================================================================
// URL Sanitization
// =============================================================================

/**
 * Sanitize a URL by removing credentials and normalizing
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // Remove username and password
    parsed.username = '';
    parsed.password = '';
    
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extract and validate hostname from a URL
 */
export function extractHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Check if two URLs have the same origin
 */
export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const parsed1 = new URL(url1);
    const parsed2 = new URL(url2);
    return parsed1.origin === parsed2.origin;
  } catch {
    return false;
  }
}

// =============================================================================
// Domain Management
// =============================================================================

/**
 * Add a domain to the allowed list at runtime
 * (Useful for dynamic configuration)
 */
export function addAllowedDomain(domain: string): void {
  if (!ALLOWED_DOMAINS.includes(domain.toLowerCase())) {
    ALLOWED_DOMAINS.push(domain.toLowerCase());
  }
}

/**
 * Remove a domain from the allowed list
 */
export function removeAllowedDomain(domain: string): void {
  const index = ALLOWED_DOMAINS.indexOf(domain.toLowerCase());
  if (index > -1) {
    ALLOWED_DOMAINS.splice(index, 1);
  }
}

/**
 * Add a domain to the blocked list
 */
export function addBlockedDomain(domain: string): void {
  if (!BLOCKED_DOMAINS.includes(domain.toLowerCase())) {
    BLOCKED_DOMAINS.push(domain.toLowerCase());
  }
}

/**
 * Get current allowed domains
 */
export function getAllowedDomains(): string[] {
  return [...ALLOWED_DOMAINS];
}

/**
 * Get current blocked domains
 */
export function getBlockedDomains(): string[] {
  return [...BLOCKED_DOMAINS];
}

// =============================================================================
// Cloud Metadata Protection
// =============================================================================

/**
 * Check if URL targets cloud metadata endpoints
 */
export function isCloudMetadataUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // AWS/GCP metadata
    if (hostname === '169.254.169.254') {
      return true;
    }
    
    // GCP metadata
    if (hostname === 'metadata.google.internal') {
      return true;
    }
    
    // Azure metadata
    if (hostname === '169.254.169.254' || hostname === 'metadata.azure.com') {
      return true;
    }
    
    // Digital Ocean metadata
    if (hostname === '169.254.169.254') {
      return true;
    }
    
    // Alibaba Cloud metadata
    if (hostname === '100.100.100.200') {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

// =============================================================================
// URL Pattern Matching
// =============================================================================

/**
 * Check if URL matches a pattern (glob-like)
 */
export function urlMatchesPattern(url: string, pattern: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*'); // Convert * to .*
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    
    return regex.test(parsed.hostname) || regex.test(parsed.href);
  } catch {
    return false;
  }
}

/**
 * Validate URL against multiple patterns
 */
export function validateUrlPatterns(
  url: string,
  allowedPatterns: string[],
  blockedPatterns: string[]
): UrlValidationResult {
  // Check blocked patterns first
  for (const pattern of blockedPatterns) {
    if (urlMatchesPattern(url, pattern)) {
      return {
        valid: false,
        error: `URL matches blocked pattern: ${pattern}`,
        details: { blockedReason: 'pattern_blocked' },
      };
    }
  }
  
  // Check allowed patterns
  if (allowedPatterns.length > 0) {
    const isAllowed = allowedPatterns.some(pattern => urlMatchesPattern(url, pattern));
    if (!isAllowed) {
      return {
        valid: false,
        error: 'URL does not match any allowed pattern',
        details: { blockedReason: 'pattern_not_allowed' },
      };
    }
  }
  
  // Also run standard validation
  return validateUrl(url);
}
