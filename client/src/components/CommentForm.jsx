import { useState } from 'react';
import API from '../api/axios';
import { MAX_COMMENT_LENGTH } from '../constants';
import { Send } from 'lucide-react';

const CommentForm = ({ articleId, onCreated }) => {
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const { data } = await API.post(`/comments/articles/${articleId}`, { content: content.trim() });
            setContent('');
            onCreated(data);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Erreur lors de l\'envoi du commentaire');
        } finally {
            setSubmitting(false);
        }
    };

    const isDisabled = submitting || !content.trim();

    return (
        <div className="glass" style={{ padding: '20px', marginBottom: '30px' }}>
            <form onSubmit={handleSubmit}>
                <label htmlFor="comment-content" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Votre commentaire (texte, Markdown ou HTML)</label>
                <textarea
                    id="comment-content"
                    placeholder="Écrivez votre commentaire ici..."
                    rows="3"
                    maxLength={MAX_COMMENT_LENGTH}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    style={{ fontFamily: 'inherit' }}
                />
                <button type="submit" className="btn btn-primary" disabled={isDisabled} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isDisabled ? 0.6 : 1 }}>
                    <Send size={18} /> {submitting ? 'Publication...' : 'Publier le commentaire'}
                </button>
            </form>
        </div>
    );
};

export default CommentForm;
