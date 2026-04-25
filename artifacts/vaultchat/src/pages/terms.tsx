import { Link } from "wouter";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link href="/login">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Terms &amp; Conditions</h1>
            <p className="text-sm text-muted-foreground">Last updated April 25, 2026</p>
          </div>
        </div>

        <div className="bg-background rounded-xl border border-border/50 shadow-sm p-6 sm:p-8 space-y-6 text-[15px] leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Acceptance</h2>
            <p>
              By creating a VaultChat account you agree to these Terms. If you do not agree, do not use the
              service. We may update these Terms periodically; continued use constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Your account</h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>You are responsible for safeguarding your username and password.</li>
              <li>You must be at least 13 years old to use VaultChat.</li>
              <li>One account per person. Do not share, sell, or transfer accounts.</li>
              <li>Notify us immediately of any unauthorized access.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Acceptable use</h2>
            <p className="mb-2">You agree <strong>not</strong> to use VaultChat to:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Harass, threaten, dox, or intimidate any person.</li>
              <li>Share content that is illegal, hateful, sexually explicit involving minors, or that promotes violence.</li>
              <li>Distribute malware, phishing links, spam, or unsolicited promotional content.</li>
              <li>Infringe intellectual-property rights or share private content without permission.</li>
              <li>Attempt to access accounts, rooms, files, or messages you are not authorized to view.</li>
              <li>Probe, scan, scrape, or stress-test the service or attempt to bypass rate limits or security.</li>
              <li>Use automation, bots, or scripts to send messages without our express written permission.</li>
              <li>Upload files containing viruses or other harmful code.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Content &amp; ownership</h2>
            <p>
              You retain ownership of the messages and files you upload. You grant VaultChat a limited license
              to store and transmit your content solely to operate the service. You are solely responsible for
              the content you share and for ensuring you have the right to share it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Privacy &amp; security</h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Passwords are stored as one-way bcrypt hashes; we never see them in plain text.</li>
              <li>Files you upload are accessible only to members of the room (or the recipient of a direct message).</li>
              <li>We log basic request metadata for abuse prevention and reliability.</li>
              <li>You are responsible for not sharing sensitive personal information of others without consent.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. File uploads</h2>
            <p>
              Files are limited to 10&nbsp;MB. Do not upload illegal content, copyrighted material you do not own,
              or files designed to harm other users or systems.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Misuse and enforcement</h2>
            <p>
              We reserve the right to suspend or terminate accounts, delete content, and revoke invite codes for any
              violation of these Terms. Severe or repeated misuse may be reported to the appropriate authorities.
              We may rate-limit, restrict, or block traffic that we believe is abusive.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. No warranties</h2>
            <p>
              VaultChat is provided "as is" without warranties of any kind. We do not guarantee uninterrupted
              service or that messages will be delivered without delay. To the fullest extent permitted by law,
              VaultChat is not liable for indirect, incidental, or consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Termination</h2>
            <p>
              You may stop using VaultChat at any time. Upon termination, your account and associated content may
              be permanently deleted. Provisions that by their nature should survive (such as ownership and
              limitations of liability) will survive termination.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Contact</h2>
            <p>
              For questions about these Terms or to report misuse, contact your VaultChat administrator.
            </p>
          </section>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          By using VaultChat you confirm that you have read and agree to these Terms &amp; Conditions.
        </p>
      </div>
    </div>
  );
}
