import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import CommentSection from './CommentSection';

vi.mock('../api/axios', () => ({
    default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    API_URL: 'http://api.test',
}));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

const BOB = { id: 2, username: 'bob' };
const comments = [
    { id: 11, content: 'Commentaire de bob', user_id: 2, username: 'bob', avatar: null, created_at: '2026-11-05T09:00:00.000Z' },
    { id: 10, content: 'Commentaire admin', user_id: 1, username: 'admin', avatar: '/uploads/a.png', created_at: '2026-11-05T08:00:00.000Z' },
];

const page = (data, extra = {}) => ({ data: { comments: data, total: data.length, hasMore: false, ...extra } });

const mount = () => render(
    <MemoryRouter>
        <CommentSection articleId="1" />
    </MemoryRouter>,
);

const renderSection = async (user = null, data = comments, extra = {}) => {
    useAuth.mockReturnValue({ user });
    API.get.mockResolvedValue(page(data, extra));
    mount();
    await screen.findByRole('heading', { name: `Commentaires (${extra.total ?? data.length})` });
};

const cardOf = (username) => screen.getByRole('link', { name: username }).closest('.glass');

describe('CommentSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('alert', vi.fn());
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('reading', () => {
        it('loads the comments of the article', async () => {
            await renderSection();

            expect(API.get).toHaveBeenCalledWith('/comments/articles/1');
            expect(screen.getByText('Commentaire de bob')).toBeTruthy();
            expect(screen.getByAltText('admin').getAttribute('src')).toBe('http://api.test/uploads/a.png');
        });

        it('does not show a count while loading', () => {
            useAuth.mockReturnValue({ user: null });
            API.get.mockReturnValue(new Promise(() => {}));
            mount();

            expect(screen.getByRole('heading').textContent.trim()).toBe('Commentaires');
        });

        it('shows an empty state', async () => {
            await renderSection(null, []);

            expect(screen.getByText('Aucun commentaire pour le moment.')).toBeTruthy();
        });

        it('shows an error when loading fails', async () => {
            useAuth.mockReturnValue({ user: null });
            API.get.mockRejectedValue(new Error('network'));
            mount();

            expect(await screen.findByText('Impossible de charger les commentaires.')).toBeTruthy();
            expect(screen.queryByText('Aucun commentaire pour le moment.')).toBeNull();
        });

        it('sanitizes the content of a comment', async () => {
            await renderSection(null, [{ ...comments[0], content: '<img src=x onerror=alert(1)>**ok**' }]);

            expect(document.querySelector('.rich-content img')).toBeNull();
            expect(document.querySelector('.rich-content strong')).not.toBeNull();
        });
    });

    describe('pagination', () => {
        const loadMoreButton = () => screen.queryByRole('button', { name: 'Charger plus de commentaires' });

        it('hides the button when there is nothing more', async () => {
            await renderSection();

            expect(loadMoreButton()).toBeNull();
        });

        it('loads the next comments from the last displayed id', async () => {
            const user = userEvent.setup();
            await renderSection(null, comments, { hasMore: true, total: 3 });
            const older = { ...comments[1], id: 5, username: 'carol', content: 'Plus ancien' };
            API.get.mockResolvedValue(page([older], { total: 3 }));

            await user.click(loadMoreButton());

            expect(API.get).toHaveBeenLastCalledWith('/comments/articles/1', { params: { before: 10 } });
            expect(await screen.findByText('Plus ancien')).toBeTruthy();
            expect(screen.getByText('Commentaire de bob')).toBeTruthy();
            expect(loadMoreButton()).toBeNull();
        });

        it('keeps the list and alerts when loading more fails', async () => {
            const user = userEvent.setup();
            await renderSection(null, comments, { hasMore: true, total: 3 });
            API.get.mockRejectedValue(new Error('network'));

            await user.click(loadMoreButton());

            expect(window.alert).toHaveBeenCalledWith('Erreur lors du chargement des commentaires');
            expect(screen.getByText('Commentaire de bob')).toBeTruthy();
            expect(loadMoreButton()).not.toBeNull();
        });
    });

    describe('visitor', () => {
        it('invites to log in and hides every action', async () => {
            await renderSection();

            expect(screen.getByRole('link', { name: 'Connectez-vous' }).getAttribute('href')).toBe('/login');
            expect(screen.queryByRole('textbox')).toBeNull();
            expect(screen.queryByRole('button')).toBeNull();
        });
    });

    describe('adding', () => {
        const publishButton = () => screen.getByRole('button', { name: /Publier le commentaire/ });

        it('disables publishing for an empty or whitespace-only content', async () => {
            const user = userEvent.setup();
            await renderSection(BOB);

            expect(publishButton().disabled).toBe(true);
            await user.type(screen.getByLabelText(/Votre commentaire/), '   ');
            expect(publishButton().disabled).toBe(true);
        });

        it('publishes a trimmed comment and shows it first without reloading', async () => {
            const user = userEvent.setup();
            await renderSection(BOB);
            API.post.mockResolvedValue({ data: { ...comments[0], id: 12, content: 'Nouveau' } });
            const field = screen.getByLabelText(/Votre commentaire/);

            await user.type(field, '  Nouveau  ');
            await user.click(publishButton());

            expect(API.post).toHaveBeenCalledWith('/comments/articles/1', { content: 'Nouveau' });
            expect(await screen.findByRole('heading', { name: 'Commentaires (3)' })).toBeTruthy();
            expect(document.querySelector('.rich-content').textContent.trim()).toBe('Nouveau');
            expect(field.value).toBe('');
            expect(API.get).toHaveBeenCalledTimes(1);
        });

        it('keeps the text and shows the server message when publishing fails', async () => {
            const user = userEvent.setup();
            await renderSection(BOB);
            API.post.mockRejectedValue({ response: { data: { message: 'Too many comments, please try again later' } } });
            const field = screen.getByLabelText(/Votre commentaire/);

            await user.type(field, 'Nouveau');
            await user.click(publishButton());

            expect(window.alert).toHaveBeenCalledWith('Too many comments, please try again later');
            expect(field.value).toBe('Nouveau');
        });

        it('alerts with a default message on a network failure', async () => {
            const user = userEvent.setup();
            await renderSection(BOB);
            API.post.mockRejectedValue(new Error('network'));

            await user.type(screen.getByLabelText(/Votre commentaire/), 'Nouveau');
            await user.click(publishButton());

            expect(window.alert).toHaveBeenCalledWith('Erreur lors de l\'envoi du commentaire');
        });
    });

    describe('ownership', () => {
        it('shows the actions on the comments of the user only', async () => {
            await renderSection(BOB);

            expect(within(cardOf('bob')).getByRole('button', { name: 'Modifier' })).toBeTruthy();
            expect(within(cardOf('bob')).getByRole('button', { name: 'Supprimer' })).toBeTruthy();
            expect(within(cardOf('admin')).queryByRole('button')).toBeNull();
        });
    });

    describe('editing', () => {
        const startEditing = async (user) => {
            await renderSection(BOB);
            await user.click(within(cardOf('bob')).getByRole('button', { name: 'Modifier' }));
            return screen.getByLabelText('Modifier le commentaire');
        };

        it('prefills the field with the current content', async () => {
            const field = await startEditing(userEvent.setup());

            expect(field.value).toBe('Commentaire de bob');
        });

        it('disables saving for a whitespace-only content', async () => {
            const user = userEvent.setup();
            const field = await startEditing(user);

            await user.clear(field);
            await user.type(field, '  ');

            expect(screen.getByRole('button', { name: 'Enregistrer' }).disabled).toBe(true);
        });

        it('sends nothing when cancelled', async () => {
            const user = userEvent.setup();
            const field = await startEditing(user);

            await user.type(field, ' modifié');
            await user.click(screen.getByRole('button', { name: 'Annuler' }));

            expect(API.put).not.toHaveBeenCalled();
            expect(screen.getByText('Commentaire de bob')).toBeTruthy();
        });

        it('saves the trimmed content and updates the card', async () => {
            const user = userEvent.setup();
            const field = await startEditing(user);
            API.put.mockResolvedValue({ data: {} });

            await user.clear(field);
            await user.type(field, '  Texte modifié ');
            await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

            expect(API.put).toHaveBeenCalledWith('/comments/11', { content: 'Texte modifié' });
            expect(await screen.findByText('Texte modifié')).toBeTruthy();
            expect(screen.queryByLabelText('Modifier le commentaire')).toBeNull();
        });

        it('keeps editing and alerts when saving fails', async () => {
            const user = userEvent.setup();
            const field = await startEditing(user);
            API.put.mockRejectedValue(new Error('network'));

            await user.type(field, ' !');
            await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

            expect(window.alert).toHaveBeenCalledWith('Erreur lors de la modification du commentaire');
            expect(field.value).toBe('Commentaire de bob !');
        });
    });

    describe('deleting', () => {
        const clickDelete = (user) => user.click(within(cardOf('bob')).getByRole('button', { name: 'Supprimer' }));

        it('does nothing when the confirmation is refused', async () => {
            const user = userEvent.setup();
            vi.spyOn(window, 'confirm').mockReturnValue(false);
            await renderSection(BOB);

            await clickDelete(user);

            expect(API.delete).not.toHaveBeenCalled();
            expect(screen.getByText('Commentaire de bob')).toBeTruthy();
        });

        it('removes the comment once confirmed', async () => {
            const user = userEvent.setup();
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            await renderSection(BOB);
            API.delete.mockResolvedValue({ data: {} });

            await clickDelete(user);

            expect(API.delete).toHaveBeenCalledWith('/comments/11');
            expect(await screen.findByRole('heading', { name: 'Commentaires (1)' })).toBeTruthy();
            expect(screen.queryByText('Commentaire de bob')).toBeNull();
        });

        it('keeps the comment and alerts when deleting fails', async () => {
            const user = userEvent.setup();
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            await renderSection(BOB);
            API.delete.mockRejectedValue(new Error('network'));

            await clickDelete(user);

            expect(window.alert).toHaveBeenCalledWith('Erreur lors de la suppression du commentaire');
            expect(screen.getByText('Commentaire de bob')).toBeTruthy();
        });
    });
});
