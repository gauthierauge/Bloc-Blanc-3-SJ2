import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import RichContent from './RichContent';

const renderContent = (content) => render(<RichContent content={content} />).container;

describe('RichContent', () => {
    afterEach(cleanup);

    it('renders plain text', () => {
        expect(renderContent('Bonjour').querySelector('p').textContent).toBe('Bonjour');
    });

    it('renders line breaks in plain text', () => {
        expect(renderContent('ligne 1\nligne 2').querySelector('br')).not.toBeNull();
    });

    it('renders Markdown', () => {
        const container = renderContent('**gras** et [lien](https://exemple.test)');

        expect(container.querySelector('strong').textContent).toBe('gras');
        expect(container.querySelector('a').getAttribute('href')).toBe('https://exemple.test');
    });

    it('renders allowed HTML', () => {
        expect(renderContent('<em>important</em>').querySelector('em').textContent).toBe('important');
    });

    const attacks = [
        ['script tags', '<script>window.__xss = true</script>', 'script'],
        ['image handlers', '<img src="x" onerror="window.__xss = true">', 'img'],
        ['iframes', '<iframe src="https://evil.test"></iframe>', 'iframe'],
        ['svg handlers', '<svg onload="window.__xss = true"></svg>', 'svg'],
        ['forms', '<form action="https://evil.test"><input name="password"></form>', 'form'],
        ['style tags', '<style>body { display: none }</style>', 'style'],
    ];

    it.each(attacks)('removes %s', (_label, payload, selector) => {
        const container = renderContent(payload);

        expect(container.querySelector(selector)).toBeNull();
        expect(window.__xss).toBeUndefined();
    });

    it('removes event handlers from allowed tags', () => {
        const link = renderContent('<a href="https://exemple.test" onclick="alert(1)">lien</a>').querySelector('a');

        expect(link.getAttribute('onclick')).toBeNull();
    });

    it('removes inline styles', () => {
        expect(renderContent('<p style="position:fixed">texte</p>').querySelector('p').getAttribute('style')).toBeNull();
    });

    it.each([
        ['an HTML link', '<a href="javascript:alert(1)">lien</a>'],
        ['a Markdown link', '[lien](javascript:alert(1))'],
    ])('removes javascript: URLs from %s', (_label, payload) => {
        const link = renderContent(payload).querySelector('a');

        expect(link?.getAttribute('href') ?? null).toBeNull();
    });

    it('does not execute a payload when mounted', () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

        renderContent('<img src=x onerror=alert(1)><script>alert(2)</script>');

        expect(alertSpy).not.toHaveBeenCalled();
    });
});
