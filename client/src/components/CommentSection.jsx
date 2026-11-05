import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { MessageCircle } from 'lucide-react';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';

const CommentSection = ({ articleId }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [fetchError, setFetchError] = useState(false);

    useEffect(() => {
        const fetchComments = async () => {
            try {
                const { data } = await API.get(`/comments/articles/${articleId}`);
                setComments(data.comments);
                setTotal(data.total);
                setHasMore(data.hasMore);
            } catch (err) {
                console.error(err);
                setFetchError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchComments();
    }, [articleId]);

    const handleLoadMore = async () => {
        setLoadingMore(true);

        try {
            const before = comments[comments.length - 1].id;
            const { data } = await API.get(`/comments/articles/${articleId}`, { params: { before } });
            setComments((current) => [...current, ...data.comments]);
            setTotal(data.total);
            setHasMore(data.hasMore);
        } catch (err) {
            console.error(err);
            alert('Erreur lors du chargement des commentaires');
        } finally {
            setLoadingMore(false);
        }
    };

    const handleCreated = (comment) => {
        setComments((current) => [comment, ...current]);
        setTotal((current) => current + 1);
    };

    const handleUpdated = (updated) => {
        setComments((current) => current.map((comment) => (comment.id === updated.id ? updated : comment)));
    };

    const handleDeleted = (commentId) => {
        setComments((current) => current.filter((comment) => comment.id !== commentId));
        setTotal((current) => current - 1);
    };

    return (
        <section style={{ marginTop: '50px', paddingTop: '30px', borderTop: '1px solid var(--border)' }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MessageCircle size={24} /> Commentaires{!loading && !fetchError && ` (${total})`}
            </h2>

            {user ? (
                <CommentForm articleId={articleId} onCreated={handleCreated} />
            ) : (
                <div className="glass" style={{ padding: '20px', marginBottom: '30px', color: 'var(--text-muted)' }}>
                    <Link to="/login" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>Connectez-vous</Link> pour ajouter un commentaire.
                </div>
            )}

            {loading && <div>Chargement...</div>}
            {!loading && fetchError && <div style={{ color: 'var(--text-muted)' }}>Impossible de charger les commentaires.</div>}
            {!loading && !fetchError && comments.length === 0 && (
                <div style={{ color: 'var(--text-muted)' }}>Aucun commentaire pour le moment.</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {comments.map((comment) => (
                    <CommentItem
                        key={comment.id}
                        comment={comment}
                        canManage={Boolean(user) && user.id === comment.user_id}
                        onUpdated={handleUpdated}
                        onDeleted={handleDeleted}
                    />
                ))}
            </div>

            {hasMore && (
                <button onClick={handleLoadMore} disabled={loadingMore} className="btn glass" style={{ marginTop: '20px', color: 'var(--text)' }}>
                    {loadingMore ? 'Chargement...' : 'Charger plus de commentaires'}
                </button>
            )}
        </section>
    );
};

export default CommentSection;
