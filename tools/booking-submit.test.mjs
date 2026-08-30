import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/js/page-modules.js', import.meta.url), 'utf8');
const handlerStart = source.lastIndexOf("    form.addEventListener('submit', async event => {");
const handlerEnd = source.indexOf('\n\n    bindNativeBookingFields();', handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, 'Booking submit handler must be present');
const pendingDeclaration = source.lastIndexOf('    let bookingSubmissionPending = false;', handlerStart);
const handlerSource = source.slice(pendingDeclaration >= 0 ? pendingDeclaration : handlerStart, handlerEnd);
const sendmailStart = source.indexOf('  const submitSendmailForm =');
const sendmailEnd = source.indexOf('\n  const initSendmailForms', sendmailStart);
assert.ok(sendmailStart >= 0 && sendmailEnd > sendmailStart, 'Shared sendmail helper must be present');
const sendmailSource = source.slice(sendmailStart, sendmailEnd);

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createHarness = ({ upload = async () => true, send = async () => false } = {}) => {
  const button = { disabled: false, textContent: 'Confirm booking', dataset: { originalText: 'Book now' } };
  const fields = { name: { value: 'Test' }, email: { value: 'qa@example.test' }, phone: { value: '+490000000' } };
  const calls = { upload: 0, send: 0, summary: 0 };
  const validation = { message: '', hidden: true, step: null, focusTarget: null };
  const bookingFileInput = {};
  const state = {
    selectedService: 'Grooming',
    selectedDate: '2030-01-02',
    selectedTime: '10:00',
    summaryConfirmed: true,
  };
  let handler;
  const form = {
    addEventListener(type, listener) {
      assert.equal(type, 'submit');
      handler = listener;
    },
    querySelector(selector) {
      return selector === '[type="submit"]' ? button : fields[selector.match(/name="([^"]+)"/)?.[1]];
    },
  };
  const noop = () => {};
  const clearValidationMessage = () => {
    validation.message = '';
    validation.hidden = true;
  };
  const context = vm.createContext({
    form,
    state,
    clearValidationMessage,
    syncHiddenFields: noop,
    isFutureDate: () => true,
    validateBookingFile: () => true,
    privacyInput: { checked: true },
    agbInput: { checked: true },
    ensureBookingFileUploaded: () => {
      calls.upload += 1;
      return upload();
    },
    getPaymentChoice: () => 'salon_cash',
    submitSendmailForm: async () => {
      calls.send += 1;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Sending...';
      try {
        return await send();
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    },
    setStep: step => {
      validation.step = step;
      clearValidationMessage();
    },
    showValidationMessage: (message, focusTarget) => {
      validation.message = message;
      validation.hidden = false;
      validation.focusTarget = focusTarget;
    },
    bookingFileInput,
    bookingCopy: { summaryConfirm: 'Confirm booking', fileUploadFailed: 'Photo upload failed. Please try again.' },
    bookingSummary: { focus: noop },
    renderBookingSummary: () => {
      calls.summary += 1;
    },
    modal: { classList: { add: noop } },
    window: { requestAnimationFrame: callback => callback() },
    resetSummaryConfirmation: () => {
      button.textContent = button.dataset.originalText;
    },
    renderFilePreview: noop,
  });
  vm.runInContext(handlerSource, context, { filename: 'page-modules.js:booking-submit' });
  return { button, calls, state, validation, bookingFileInput, submit: () => handler({ preventDefault: noop }) };
};

test('booking ignores repeat submission while the photo upload is pending', async () => {
  const upload = deferred();
  const harness = createHarness({ upload: () => upload.promise });
  const first = harness.submit();
  const repeated = harness.submit();

  assert.equal(harness.button.disabled, true);
  assert.equal(harness.calls.upload, 1);
  assert.equal(harness.calls.send, 0);
  upload.resolve(true);
  await Promise.all([first, repeated]);
  assert.equal(harness.calls.send, 1);
  assert.equal(harness.button.disabled, false);
});

test('booking without a photo ignores repeat submission while sendmail is pending', async () => {
  const send = deferred();
  const harness = createHarness({ send: () => send.promise });
  const first = harness.submit();
  await setImmediate();
  assert.equal(harness.calls.send, 1);
  assert.equal(harness.button.disabled, true);

  const repeated = harness.submit();
  await setImmediate();
  assert.equal(harness.calls.upload, 1);
  assert.equal(harness.calls.send, 1);
  send.resolve(false);
  await Promise.all([first, repeated]);
  assert.equal(harness.button.disabled, false);
  assert.equal(harness.button.textContent, 'Confirm booking');
});

test('an unsuccessful photo upload releases the booking lock for retry', async () => {
  let attempt = 0;
  const harness = createHarness({ upload: async () => ++attempt > 1 });
  await harness.submit();
  assert.equal(harness.button.disabled, false);
  assert.equal(harness.calls.send, 0);
  await harness.submit();
  assert.equal(harness.calls.upload, 2);
  assert.equal(harness.calls.send, 1);
});

test('a failed photo upload leaves its error visible after returning to the file step', async () => {
  const retry = deferred();
  let attempt = 0;
  const harness = createHarness({ upload: async () => (++attempt === 1 ? false : retry.promise) });

  await harness.submit();
  assert.equal(harness.validation.step, 3);
  assert.equal(harness.validation.hidden, false);
  assert.equal(harness.validation.message, 'Photo upload failed. Please try again.');
  assert.equal(harness.validation.focusTarget, harness.bookingFileInput);
  assert.equal(harness.button.disabled, false);
  assert.equal(harness.calls.send, 0);

  const pendingRetry = harness.submit();
  assert.equal(harness.validation.hidden, true);
  assert.equal(harness.validation.message, '');
  assert.equal(harness.button.disabled, true);
  retry.resolve(true);
  await pendingRetry;
  assert.equal(harness.calls.upload, 2);
  assert.equal(harness.calls.send, 1);
});

test('an unexpected upload error releases the booking lock for retry', async () => {
  let attempt = 0;
  const harness = createHarness({
    upload: async () => {
      if (++attempt === 1) throw new Error('Upload interrupted');
      return true;
    },
  });
  await assert.rejects(harness.submit(), /Upload interrupted/);
  assert.equal(harness.button.disabled, false);
  await harness.submit();
  assert.equal(harness.calls.upload, 2);
  assert.equal(harness.calls.send, 1);
});

test('a failed send releases the booking lock and preserves the confirm label for retry', async () => {
  const harness = createHarness();
  await harness.submit();
  assert.equal(harness.button.disabled, false);
  assert.equal(harness.button.textContent, 'Confirm booking');
  await harness.submit();
  assert.equal(harness.calls.send, 2);
});

test('a successful send releases the lock without overwriting the reset button label', async () => {
  const harness = createHarness({ send: async () => true });
  await harness.submit();
  assert.equal(harness.button.disabled, false);
  assert.equal(harness.button.textContent, 'Book now');
  assert.equal(harness.state.summaryConfirmed, false);
  assert.equal(harness.state.selectedService, '');
});

test('the summary confirmation step does not acquire the submission lock', async () => {
  const harness = createHarness();
  harness.state.summaryConfirmed = false;
  harness.button.textContent = 'Book now';
  await harness.submit();
  assert.equal(harness.calls.summary, 1);
  assert.equal(harness.calls.upload, 0);
  assert.equal(harness.button.disabled, false);
  assert.equal(harness.button.textContent, 'Confirm booking');
  await harness.submit();
  assert.equal(harness.calls.send, 1);
});

const jsonResponse = (status, result) => ({ ok: status >= 200 && status < 300, status, json: async () => result });

const createSendmailHarness = ({ localStatic = false, request }) => {
  const requests = [];
  const timers = [];
  const statuses = [];
  const button = { disabled: false, textContent: 'Send' };
  const fallbackUrl = localStatic ? 'http://127.0.0.1:8788/sendmail' : '';
  const form = {
    querySelectorAll: () => [],
    appendChild: element => statuses.push(element),
    reset() {},
    dispatchEvent() {},
  };
  const context = vm.createContext({
    document: {
      createElement() {
        const classes = new Set();
        return {
          classList: { add: name => classes.add(name), contains: name => classes.has(name) },
          setAttribute() {},
          focus() {},
          textContent: '',
        };
      },
    },
    window: {
      AbortController,
      setTimeout(callback, milliseconds) {
        const timer = { callback, milliseconds, cleared: false };
        timers.push(timer);
        return timer;
      },
      clearTimeout(timer) {
        if (timer) timer.cleared = true;
      },
      requestAnimationFrame: callback => callback(),
    },
    pageLang: 'en',
    formCopy: {
      sending: { en: 'Sending' },
      success: { en: 'Success' },
      error: { en: 'Send failed' },
      localFunctionsRequired: { en: url => `Open local Functions: ${url}` },
    },
    LOCAL_SENDMAIL_PROBE_TIMEOUT_MS: 4500,
    getSendmailEndpoints: () => (fallbackUrl ? ['/sendmail', fallbackUrl] : ['/sendmail']),
    getLocalCloudflareSendmailUrl: () => fallbackUrl,
    getLocalCloudflarePageUrl: () => (fallbackUrl ? 'http://127.0.0.1:8788/en/kontakty.html' : ''),
    FormData: class {
      entries() {
        return [][Symbol.iterator]();
      }
    },
    CustomEvent: class {},
    fetch: (url, options) => {
      requests.push({ url, options });
      return request(url, options);
    },
  });
  const submit = vm.runInContext(`${sendmailSource}\nsubmitSendmailForm;`, context, {
    filename: 'page-modules.js:submitSendmailForm',
  });
  return { requests, timers, statuses, button, submit: () => submit(form, button) };
};

test('production send waits for its delayed HTTP result without the local probe deadline', async () => {
  const response = deferred();
  const harness = createSendmailHarness({ request: () => response.promise });
  const sending = harness.submit();
  assert.equal(harness.button.disabled, true);
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0].options.signal, undefined);
  assert.equal(harness.timers.length, 0);

  response.resolve(jsonResponse(200, { success: true }));
  assert.equal(await sending, true);
  assert.equal(harness.statuses.at(-1).textContent, 'Success');
  assert.equal(harness.button.disabled, false);
});

for (const status of [404, 405]) {
  test(`a local static ${status} response can use the Pages fallback without a short deadline`, async () => {
    const harness = createSendmailHarness({
      localStatic: true,
      request: async url => jsonResponse(url === '/sendmail' ? status : 200, { success: url !== '/sendmail' }),
    });
    assert.equal(await harness.submit(), true);
    assert.equal(harness.requests.length, 2);
    assert.ok(harness.requests[0].options.signal instanceof AbortSignal);
    assert.equal(harness.requests[1].options.signal, undefined);
    assert.equal(harness.timers.length, 1);
    assert.equal(harness.timers[0].milliseconds, 4500);
    assert.equal(harness.timers[0].cleared, true);
  });
}

test('a local network error does not silently resend a request with unknown delivery status', async () => {
  const harness = createSendmailHarness({
    localStatic: true,
    request: async () => {
      throw new Error('Network interrupted');
    },
  });
  assert.equal(await harness.submit(), false);
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.button.disabled, false);
});

test('a local probe timeout does not silently resend to the Pages fallback', async () => {
  const harness = createSendmailHarness({
    localStatic: true,
    request: (url, { signal }) =>
      new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('AbortError')))),
  });
  const sending = harness.submit();
  assert.equal(harness.timers.length, 1);
  harness.timers[0].callback();
  assert.equal(await sending, false);
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.button.disabled, false);
});

for (const status of [400, 429, 500]) {
  test(`a local ${status} response is handled without a second POST`, async () => {
    const harness = createSendmailHarness({
      localStatic: true,
      request: async () => jsonResponse(status, { success: false, message: 'Request was not accepted' }),
    });
    assert.equal(await harness.submit(), false);
    assert.equal(harness.requests.length, 1);
    assert.equal(harness.statuses.at(-1).textContent, 'Request was not accepted');
    assert.equal(harness.button.disabled, false);
  });
}
