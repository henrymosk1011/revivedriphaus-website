// Form endpoints. The site is static, so forms need a backend to receive
// submissions. Paste an endpoint URL (e.g. Formspree, Basin, or your own API)
// that accepts a POSTed FormData body and returns 2xx on success.
//
// Until an endpoint is set:
//   contact    → opens the visitor's email app with the message pre-filled
//   newsletter → opens the visitor's email app with a subscribe request
//   consent    → asks the patient to call/text (no medical data leaves the page)
//
// The consent form collects medical history (PHI). Only connect it to a
// HIPAA-compliant service that will sign a BAA (e.g. Jotform HIPAA, IntakeQ).
export const FORM_ENDPOINTS = {
  contact: '',
  newsletter: '',
  consent: '',
};
