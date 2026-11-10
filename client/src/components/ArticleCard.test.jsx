import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ArticleCard from './ArticleCard';

const renderCard = (commentCount) => render(
    <MemoryRouter>
        <ArticleCard
            article={{
                id: 1,
                title: 'Mon article',
                content: 'Du contenu',
                username: 'alice',
                comment_count: commentCount,
            }}
        />
    </MemoryRouter>,
);

describe('ArticleCard', () => {
    afterEach(cleanup);

    const cases = [
        [0, '0 commentaire'],
        [1, '1 commentaire'],
        [2, '2 commentaires'],
        [15, '15 commentaires'],
    ];

    for (const [count, label] of cases) {
        it(`shows "${label}"`, () => {
            renderCard(count);

            expect(screen.getByText(label)).toBeTruthy();
        });
    }
});
