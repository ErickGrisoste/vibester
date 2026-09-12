import { describe, it, expect } from "vitest";
import { renderTemplate } from "../templateRenderer.service";

describe("renderTemplate", () => {
    it("renders welcome.html substituting {{name}} and {{platformLink}}", async () => {
        const html = await renderTemplate("welcome.html", {
            name: "Maria",
            platformLink: "https://vibester.com.br",
        });

        expect(html).toContain("Maria");
        expect(html).toContain("https://vibester.com.br");
    });

    it("renders two_factor_code.html substituting {{name}} and {{code}}", async () => {
        const html = await renderTemplate("two_factor_code.html", {
            name: "João",
            code: "123456",
        });

        expect(html).toContain("João");
        expect(html).toContain("123456");
    });

    it("renders reset_password.html substituting {{name}} and {{resetLink}}", async () => {
        const html = await renderTemplate("reset_password.html", {
            name: "Ana",
            resetLink: "https://vibester.com.br/reset/abc123",
        });

        expect(html).toContain("Ana");
        expect(html).toContain("https://vibester.com.br/reset/abc123");
    });

    it("rejects (ENOENT) when the template file does not exist", async () => {
        await expect(renderTemplate("does-not-exist.html", {})).rejects.toThrow();
    });
});
