# Error 503 Service Unavailable

If you receive a 503 error during an OrbitWork App deployment:

1. Check your `orbit.config.json` file. Ensure `region` is set to a valid zone (us-east-1, eu-west-1).
2. Verify you haven't exceeded your monthly compute quota.
3. If the error persists, run `orbit diagnostics --verbose` in your CLI and check the logs for "Memory Limit Exceeded".

