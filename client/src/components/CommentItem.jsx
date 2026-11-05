import { useState } from 'react';
import { Link } from 'react-router-dom';
import API, { API_URL } from '../api/axios';
import { MAX_COMMENT_LENGTH } from '../constants';
import { Calendar, Check, Edit, Trash2, User, X } from 'lucide-react';
import RichContent from './RichContent';

const CommentItem = ({ comment, canManage, onUpdated, onDeleted }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [saving, setSaving] = useState(false);

    const startEditing = () => {
        setEditContent(comment.content);
        setIsEditing(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const content = editContent.trim();
            await API.put(`/comments/${comment.id}`, { content });
            onUpdated({ ...comment, content });
            setIsEditing(false);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Erreur lors de la modification du commentaire');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Voulez-vous vraiment supprimer ce commentaire ?')) {
            try {
                await API.delete(`/comments/${comment.id}`);
                onDeleted(comment.id);
            } catch (err) {
                console.error(err);
                alert(err.response?.data?.message || 'Erreur lors de la suppression du commentaire');
            }
        }
    };

    const isSaveDisabled = saving || !editContent.trim();

    return (
        <div className="glass" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {comment.avatar ? (
                        <img src={`${API_URL}${comment.avatar}`} alt={comment.username} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                    ) : <User />}
                    <div>
                        <Link to={`/profile/${comment.user_id}`} style={{ fontWeight: 'bold' }}>{comment.username}</Link>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Calendar size={14} /> {new Date(comment.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {canManage && !isEditing && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={startEditing} className="btn glass" style={{ padding: '8px 12px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Edit size={16} /> Modifier
                        </button>
                        <button onClick={handleDelete} className="btn" style={{ padding: '8px 12px', background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Trash2 size={16} /> Supprimer
                        </button>
                    </div>
                )}
            </div>

            {isEditing ? (
                <form onSubmit={handleUpdate}>
                    <textarea
                        aria-label="Modifier le commentaire"
                        rows="3"
                        maxLength={MAX_COMMENT_LENGTH}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        style={{ fontFamily: 'inherit' }}
                        autoFocus
                    />
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="submit" className="btn btn-primary" disabled={isSaveDisabled} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '5px', opacity: isSaveDisabled ? 0.6 : 1 }}>
                            <Check size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                        <button type="button" onClick={() => setIsEditing(false)} className="btn glass" style={{ padding: '8px 12px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <X size={16} /> Annuler
                        </button>
                    </div>
                </form>
            ) : (
                <RichContent content={comment.content} />
            )}
        </div>
    );
};

export default CommentItem;
