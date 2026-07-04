import { chromium } from 'playwright';
import * as db from './db.js';
import * as claude from './claude.js';

export async function runApplyAssist(jobId) {
    const job = db.getJob(jobId);
    if (!job || !job.link) throw new Error("Job or link not found");

    const profile = db.getProfile();
    const answersMap = db.getAnswers();

    // Launch visible browser
    console.log(`Starting Apply Assist for job: ${job.company} - ${job.role}`);
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto(job.link, { waitUntil: 'networkidle', timeout: 60000 });
        
        // Wait an extra moment just in case there's some late-rendering JS (like Greenhouse embedded forms)
        await page.waitForTimeout(2000);

        // Extract form fields
        const fields = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
            return inputs.map(i => {
                let label = '';
                if (i.labels && i.labels.length > 0) {
                    label = i.labels[0].innerText;
                } else if (i.closest('label')) {
                    label = i.closest('label').innerText;
                } else {
                    // Sometimes there's a div acting as a label right above
                    const prevElement = i.previousElementSibling;
                    if (prevElement && prevElement.tagName !== 'INPUT') {
                        label = prevElement.innerText;
                    }
                    if (!label || label.trim().length === 0) {
                        label = i.getAttribute('aria-label') || i.name || i.id;
                    }
                }

                // Add innerText for selects to give Claude options
                let options = [];
                if (i.tagName.toLowerCase() === 'select') {
                    options = Array.from(i.options).map(opt => opt.innerText.trim());
                }

                return {
                    id: i.id || undefined,
                    name: i.name || undefined,
                    type: i.type || i.tagName.toLowerCase(),
                    label: label?.trim(),
                    options: options.length > 0 ? options : undefined
                };
            }).filter(f => f.label && f.id);
        });

        if (fields.length === 0) {
            console.log("No form fields found with IDs. Leaving browser open for manual review.");
            return;
        }

        console.log(`Extracted ${fields.length} form fields. Requesting AI mapping...`);
        const answers = await claude.answerForm(fields, profile, answersMap);

        // Fill form
        for (const ans of answers) {
            if (!ans.value || !ans.id) continue;
            const field = fields.find(f => f.id === ans.id);
            if (!field) continue;
            
            const selector = `[id="${ans.id}"]`;
            try {
                if (field.type === 'checkbox' || field.type === 'radio') {
                    if (['true', 'yes', 'on'].includes(ans.value.toLowerCase())) {
                        await page.check(selector, { force: true });
                    }
                } else if (field.type === 'select-one' || field.type === 'select-multiple') {
                    await page.selectOption(selector, { label: ans.value }).catch(() => 
                        page.selectOption(selector, ans.value)
                    );
                } else if (field.type === 'file') {
                   // Skip file uploads for now; let user handle manually.
                   continue;
                } else {
                    await page.fill(selector, ans.value);
                }
                
                // Save mapping for next time
                if (field.label) {
                    db.saveAnswer(field.label, ans.value);
                }
            } catch (e) {
                console.error(`Failed to fill field ${ans.id}:`, e.message);
            }
        }
        
        console.log("Auto-fill complete. Please review and submit the application in the opened browser window.");
        // We DO NOT close the browser because we want the human to review and click submit!
    } catch (err) {
        console.error("Apply assist encountered an error:", err);
    }
}
