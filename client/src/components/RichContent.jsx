import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'a', 'ul', 'ol', 'li',
    'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
];

const RichContent = ({ content }) => {
    const html = useMemo(() => DOMPurify.sanitize(marked.parse(content, { breaks: true }), {
        ALLOWED_TAGS,
        ALLOWED_ATTR: ['href', 'title'],
    }), [content]);

    return <div className="rich-content" dangerouslySetInnerHTML={{ __html: html }} />;
};

export default RichContent;
