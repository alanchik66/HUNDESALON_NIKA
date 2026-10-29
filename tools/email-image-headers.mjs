for (const base of ['https://hundesalon-nika.com', 'https://hundesalon-nika.pages.dev']) {
  const r = await fetch(`${base}/assets/images/email/logo.png?verify=${Date.now()}`);
  console.log(
    JSON.stringify({
      base,
      status: r.status,
      headers: Object.fromEntries(
        [...r.headers].filter(([k]) => /cross-origin|content-type|cache|age|location/.test(k))
      ),
    })
  );
}
