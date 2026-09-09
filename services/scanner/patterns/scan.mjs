import { scanSeries } from '../../../web/src/lib/patterns/engine/scan.mjs';
import { pathToFileURL } from 'node:url';
export { scanSeries };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const payload = JSON.parse(input);
  process.stdout.write(JSON.stringify(Array.isArray(payload)
    ? scanSeries(payload) : scanSeries(payload.series, new Date(), payload.pattern)));
}
