# Security Policy

## Supported versions

Only the latest commit on the `main` branch is supported.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Use GitHub's private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. Include the affected component (server API, authentication or LDAP, locking, Windows service, installer), reproduction steps and the impact you observed.

You can expect an acknowledgement within a few days. Confirmed issues are fixed on `main` and disclosed after a fix is available.

## Scope notes

- Admin credentials, the initial admin reset code and the LDAP bind password are supplied through environment variables or ignored local files and must never be committed.
- Department project endpoints require an authenticated session; password-protected departments require the department password.
- Dependencies are monitored with Dependabot and secret scanning with push protection.
