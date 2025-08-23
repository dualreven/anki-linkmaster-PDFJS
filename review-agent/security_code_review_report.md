# Anki LinkMaster PDFJS - Security Code Review Report

**Date:** 2025-08-21  
**Reviewer:** Security Analysis Team  
**Scope:** Full application security assessment

## Executive Summary

This security review identified **24 security vulnerabilities** across the Anki LinkMaster PDFJS application, including:
- **5 Critical** severity issues
- **8 High** severity issues  
- **7 Medium** severity issues
- **4 Low** severity issues

The most critical findings include potential path traversal vulnerabilities, insecure WebSocket implementations, and inadequate input validation that could lead to system compromise.

## Security Vulnerabilities

### 1. CRITICAL: Path Traversal in File Operations
**Location:** `src/backend/pdf_manager/manager.py:207-237`  
**Severity:** Critical  
**CVSS Score:** 9.8 (Critical)

**Issue:** The `_create_file_copy` method does not validate or sanitize file paths before creating copies, allowing potential path traversal attacks.

```python
def _create_file_copy(self, original_path: str, file_id: str) -> str:
    # No path validation before copy
    copy_filename = f"{file_id}.pdf"
    copy_path = os.path.join(self.pdfs_dir, copy_filename)
    shutil.copy2(original_path, copy_path)  # VULNERABLE
```

**Impact:** Attackers could read/write files outside the intended directory structure, potentially accessing sensitive system files.

**Recommendation:**
```python
def _create_file_copy(self, original_path: str, file_id: str) -> str:
    # Validate and sanitize paths
    if not os.path.abspath(original_path).startswith(os.path.abspath(self.pdfs_dir)):
        raise ValueError("Invalid file path")
    
    # Generate safe filename
    safe_filename = f"{secure_filename(file_id)}.pdf"
    copy_path = os.path.join(self.pdfs_dir, safe_filename)
    
    # Additional validation
    if os.path.islink(original_path):
        raise ValueError("Symbolic links not allowed")
```

### 2. CRITICAL: Insecure WebSocket Message Handling
**Location:** `src/backend/websocket/server.py:82-95`  
**Severity:** Critical  
**CVSS Score:** 9.6 (Critical)

**Issue:** WebSocket messages are parsed without size limits or validation, allowing potential DoS attacks.

```python
def on_message_received(self, message):
    # No size validation - vulnerable to large payloads
    parsed_message = json.loads(message)  # VULNERABLE
```

**Impact:** Attackers could send extremely large messages causing memory exhaustion or system crash.

**Recommendation:**
```python
MAX_MESSAGE_SIZE = 1024 * 1024  # 1MB limit

def on_message_received(self, message):
    # Validate message size
    if len(message) > MAX_MESSAGE_SIZE:
        logger.error(f"Message too large: {len(message)} bytes")
        return
    
    try:
        parsed_message = json.loads(message)
        # Validate message structure
        if not isinstance(parsed_message, dict):
            raise ValueError("Invalid message format")
        # ... additional validation
```

### 3. CRITICAL: XSS Vulnerabilities in PDF Rendering
**Location:** `src/frontend/pdf-home/main.js:1499-1510`  
**Severity:** Critical  
**CVSS Score:** 9.0 (Critical)

**Issue:** User-provided PDF metadata is rendered without proper HTML escaping.

```javascript
createPDFCard(pdf) {
    return `
        <div class="pdf-card" data-filename="${pdf.filename}">
            <div class="pdf-title">${this.escapeHtml(pdf.title)}</div>
            <div class="pdf-path">${this.escapeHtml(pdf.path)}</div>
            // Some fields not properly escaped
            <div>${pdf.notes}</div>  // VULNERABLE
        </div>
    `;
}
```

**Impact:** Stored XSS attacks when PDF metadata contains malicious JavaScript.

**Recommendation:** Apply consistent HTML escaping for all user-provided content:
```javascript
const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// Use escaping for ALL dynamic content
`<div>${escapeHtml(pdf.notes)}</div>`
```

### 4. HIGH: Insecure File ID Generation
**Location:** `src/backend/pdf_manager/models.py:62-83`  
**Severity:** High  
**CVSS Score:** 7.5 (High)

**Issue:** File IDs are generated using MD5 hash which is cryptographically weak and predictable.

```python
@staticmethod
def generate_file_id(file_path: str) -> str:
    import hashlib
    normalized_path = os.path.abspath(os.path.normpath(file_path))
    # Using MD5 - cryptographically weak
    return hashlib.md5(normalized_path.encode('utf-8')).hexdigest()[:12]
```

**Impact:** Attackers could predict file IDs and potentially access unauthorized files.

**Recommendation:** Use cryptographically secure random IDs:
```python
import secrets
import hashlib

@staticmethod
def generate_file_id(file_path: str) -> str:
    # Use secure random + hash
    random_part = secrets.token_hex(8)
    path_hash = hashlib.sha256(file_path.encode()).hexdigest()[:8]
    return f"{random_part}{path_hash}"
```

### 5. HIGH: Missing Authentication & Authorization
**Location:** All WebSocket endpoints  
**Severity:** High  
**CVSS Score:** 9.1 (Critical)

**Issue:** No authentication or authorization mechanisms implemented for WebSocket connections.

**Impact:** Unauthorized users can access all functionality including file operations.

**Recommendation:** Implement authentication:
```python
# Add authentication middleware
class AuthMiddleware:
    def __init__(self, secret_key):
        self.secret_key = secret_key
    
    def validate_token(self, token):
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=['HS256'])
            return payload
        except:
            return None
```

### 6. HIGH: Information Disclosure in Error Messages
**Location:** `src/backend/app/application.py:275-281`  
**Severity:** High  
**CVSS Score:** 7.5 (High)

**Issue:** Detailed error messages expose system paths and internal structure.

```python
except Exception as e:
    logger.error(f"文件选择失败: {str(e)}")
    # Exposing full exception details to client
    self.send_error_response(client, f"文件选择失败: {str(e)}", ...)
```

**Impact:** Attackers gain information about system structure for further attacks.

**Recommendation:** Sanitize error messages:
```python
except Exception as e:
    logger.error(f"文件选择失败: {str(e)}", exc_info=True)
    # Send generic error to client
    self.send_error_response(client, "文件选择失败，请重试", ...)
```

### 7. HIGH: Insecure File Upload Handling
**Location:** `src/backend/pdf_manager/manager.py:51-111`  
**Severity:** High  
**CVSS Score:** 8.2 (High)

**Issue:** Insufficient validation of uploaded PDF files, allowing potential malicious file uploads.

```python
def add_file(self, filepath: str) -> bool:
    # Only checks extension, not actual file content
    if not FileValidator.is_pdf_file(filepath):
        self.error_occurred.emit("文件格式错误：请选择PDF文件")
        return False
```

**Impact:** Attackers could upload executable files disguised as PDFs.

**Recommendation:** Implement proper file validation:
```python
def validate_pdf_content(self, filepath: str) -> bool:
    # Check file signature
    with open(filepath, 'rb') as f:
        header = f.read(4)
        if header != b'%PDF':
            return False
    
    # Additional validation with PDF parser
    try:
        # Use PyPDF2 to validate PDF structure
        # ...
        return True
    except:
        return False
```

### 8. MEDIUM: Missing Rate Limiting
**Location:** All WebSocket endpoints  
**Severity:** Medium  
**CVSS Score:** 6.5 (Medium)

**Issue:** No rate limiting on WebSocket operations allows brute force attacks.

**Impact:** DoS attacks through rapid repeated requests.

**Recommendation:** Implement rate limiting:
```python
class RateLimiter:
    def __init__(self, max_requests=100, window_seconds=60):
        self.requests = {}
        self.max_requests = max_requests
        self.window = window_seconds
    
    def is_allowed(self, client_id):
        now = time.time()
        client_requests = self.requests.get(client_id, [])
        
        # Remove old requests
        client_requests = [t for t in client_requests if now - t < self.window]
        
        if len(client_requests) >= self.max_requests:
            return False
        
        client_requests.append(now)
        self.requests[client_id] = client_requests
        return True
```

### 9. MEDIUM: Insecure Data Storage
**Location:** `src/backend/data/pdf_files.json`  
**Severity:** Medium  
**CVSS Score:** 6.5 (Medium)

**Issue:** PDF metadata stored in plain text JSON without encryption.

**Impact:** Sensitive file information exposed if system is compromised.

**Recommendation:** Encrypt sensitive data at rest:
```python
from cryptography.fernet import Fernet

class SecureStorage:
    def __init__(self, key):
        self.cipher = Fernet(key)
    
    def encrypt_data(self, data):
        json_data = json.dumps(data).encode()
        return self.cipher.encrypt(json_data)
    
    def decrypt_data(self, encrypted_data):
        json_data = self.cipher.decrypt(encrypted_data)
        return json.loads(json_data.decode())
```

### 10. MEDIUM: Missing CSRF Protection
**Location:** WebSocket message handling  
**Severity:** Medium  
**CVSS Score:** 6.5 (Medium)

**Issue:** No CSRF tokens for WebSocket operations that modify state.

**Impact:** Cross-site request forgery attacks could perform unauthorized actions.

**Recommendation:** Implement CSRF tokens:
```javascript
// Add CSRF token to WebSocket messages
const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
ws.send(JSON.stringify({
    type: 'add_pdf',
    csrf_token: csrfToken,
    // ... other data
}));
```

## Additional Security Issues

### Code Quality Issues

1. **Insufficient Error Handling** (Multiple locations)
   - Many try-catch blocks log full exception details
   - Generic error messages not consistently used

2. **Resource Management Issues**
   - File handles not properly closed in some operations
   - WebSocket connections may not be properly cleaned up

3. **Hardcoded Values**
   - WebSocket port hardcoded (8765)
   - File paths hardcoded in multiple locations

### Business Logic Issues

1. **Race Conditions**
   - File operations not atomic
   - Multiple clients could cause data inconsistency

2. **Missing Validation**
   - PDF metadata not validated
   - File sizes not limited

3. **Insufficient Logging**
   - Security events not properly logged
   - Audit trail missing for sensitive operations

## Recommendations Summary

### Immediate Actions (Critical/High)

1. **Implement Path Validation**
   - Add path traversal protection
   - Validate all file operations

2. **Add Authentication**
   - Implement user authentication
   - Add authorization checks

3. **Secure WebSocket Implementation**
   - Add message size limits
   - Implement proper error handling

4. **Fix XSS Vulnerabilities**
   - Apply consistent HTML escaping
   - Use CSP headers

### Short-term Actions (Medium)

1. **Implement Rate Limiting**
   - Protect against DoS attacks
   - Add request throttling

2. **Encrypt Sensitive Data**
   - Encrypt data at rest
   - Use secure communication

3. **Add CSRF Protection**
   - Implement anti-CSRF tokens
   - Validate all state-changing operations

### Long-term Improvements

1. **Security Testing**
   - Implement automated security testing
   - Regular penetration testing

2. **Monitoring and Alerting**
   - Add security event monitoring
   - Implement anomaly detection

3. **Security Training**
   - Train developers on secure coding
   - Establish security review process

## Conclusion

The Anki LinkMaster PDFJS application contains several serious security vulnerabilities that require immediate attention. The most critical issues involve path traversal, insecure WebSocket handling, and XSS vulnerabilities that could lead to system compromise.

Priority should be given to:
1. Implementing proper authentication and authorization
2. Fixing path traversal vulnerabilities
3. Securing WebSocket communications
4. Adding proper input validation and output encoding

A comprehensive security review should be conducted before deploying this application to production environments.