/**
 * EZ Play TV - Data Module
 * Sample data for the application
 */

const Data = {
    countries: [
        { name: 'Italy', flag: '🇮🇹', channels: 89, selected: false },
        { name: 'Ukraine', flag: '🇺🇦', channels: 45, selected: false },
        { name: 'Brazil', flag: '🇧🇷', channels: 120, selected: false },
        { name: 'Germany', flag: '🇩🇪', channels: 95, selected: false },
        { name: 'United States', flag: '🇺🇸', channels: 147, selected: true },
        { name: 'France', flag: '🇫🇷', channels: 78, selected: false },
        { name: 'Portugal', flag: '🇵🇹', channels: 42, selected: false },
        { name: 'South Africa', flag: '🇿🇦', channels: 35, selected: false },
        { name: 'China', flag: '🇨🇳', channels: 156, selected: false }
    ],
    
    channels: [
        { name: 'Nat Geo Wild HD', logo: 'NAT GEO WILD', views: '+8.2M Views', badges: ['HD', 'EPG'], favorite: true },
        { name: 'Disney Channel', logo: 'Disney Channel', views: '850K Views', badges: ['4K', 'EPG', '$'], favorite: false },
        { name: 'HBO Family', logo: 'HBO', views: '1.7M Views', badges: ['HD'], favorite: false },
        { name: 'ESPN Sports', logo: 'ESPN', views: '3.2M Views', badges: ['HD', 'EPG'], favorite: false },
        { name: 'CNN International', logo: 'CNN', views: '2.1M Views', badges: ['HD'], favorite: false }
    ],
    
    genres: [
        { name: 'All Movies', icon: 'grid', selected: true },
        { name: 'Action', icon: 'action', selected: false },
        { name: 'Comedy', icon: 'comedy', selected: false },
        { name: 'Drama', icon: 'drama', selected: false },
        { name: 'Sci-Fi', icon: 'scifi', selected: false },
        { name: 'Horror', icon: 'horror', selected: false },
        { name: 'Romance', icon: 'romance', selected: false },
        { name: 'Thriller', icon: 'thriller', selected: false }
    ],
    
    movies: [
        {
            id: 1,
            title: 'Inception',
            year: '2010',
            duration: '2h 28m',
            rating: '8.8',
            quality: '4K',
            poster: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=300&h=450&fit=crop',
            backdrop: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1920&h=1080&fit=crop',
            tagline: 'Your mind is the scene of the crime',
            description: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
            genres: ['Action', 'Sci-Fi', 'Thriller'],
            cast: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page']
        },
        {
            id: 2,
            title: 'The Dark Knight',
            year: '2008',
            duration: '2h 32m',
            rating: '9.0',
            quality: '4K',
            poster: 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=300&h=450&fit=crop',
            backdrop: 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=1920&h=1080&fit=crop',
            tagline: 'Why so serious?',
            description: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
            genres: ['Action', 'Crime', 'Drama'],
            cast: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart']
        },
        {
            id: 3,
            title: 'Interstellar',
            year: '2014',
            duration: '2h 49m',
            rating: '8.6',
            quality: '4K',
            poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=300&h=450&fit=crop',
            backdrop: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&h=1080&fit=crop',
            tagline: 'Mankind was born on Earth. It was never meant to die here.',
            description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.',
            genres: ['Adventure', 'Drama', 'Sci-Fi'],
            cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain']
        },
        {
            id: 4,
            title: 'Pulp Fiction',
            year: '1994',
            duration: '2h 34m',
            rating: '8.9',
            quality: 'HD',
            poster: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=300&h=450&fit=crop',
            backdrop: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=1920&h=1080&fit=crop',
            tagline: 'Just because you are a character doesn\'t mean you have character.',
            description: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.',
            genres: ['Crime', 'Drama'],
            cast: ['John Travolta', 'Uma Thurman', 'Samuel L. Jackson']
        },
        {
            id: 5,
            title: 'The Matrix',
            year: '1999',
            duration: '2h 16m',
            rating: '8.7',
            quality: '4K',
            poster: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&h=450&fit=crop',
            backdrop: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&h=1080&fit=crop',
            tagline: 'Welcome to the Real World.',
            description: 'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.',
            genres: ['Action', 'Sci-Fi'],
            cast: ['Keanu Reeves', 'Laurence Fishburne', 'Carrie-Anne Moss']
        },
        {
            id: 6,
            title: 'Forrest Gump',
            year: '1994',
            duration: '2h 22m',
            rating: '8.8',
            quality: 'HD',
            poster: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300&h=450&fit=crop',
            backdrop: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1920&h=1080&fit=crop',
            tagline: 'Life is like a box of chocolates.',
            description: 'The presidencies of Kennedy and Johnson, the events of Vietnam, Watergate and other historical events unfold from the perspective of an Alabama man with an IQ of 75.',
            genres: ['Drama', 'Romance'],
            cast: ['Tom Hanks', 'Robin Wright', 'Gary Sinise']
        },
        {
            id: 7,
            title: 'Fight Club',
            year: '1999',
            duration: '2h 19m',
            rating: '8.8',
            quality: 'HD',
            poster: 'https://images.unsplash.com/photo-1549692520-acc6669e2f0c?w=300&h=450&fit=crop',
            backdrop: 'https://images.unsplash.com/photo-1549692520-acc6669e2f0c?w=1920&h=1080&fit=crop',
            tagline: 'Mischief. Mayhem. Soap.',
            description: 'An insomniac office worker and a devil-may-care soapmaker form an underground fight club that evolves into something much, much more.',
            genres: ['Drama'],
            cast: ['Brad Pitt', 'Edward Norton', 'Helena Bonham Carter']
        },
        {
            id: 8,
            title: 'The Shawshank Redemption',
            year: '1994',
            duration: '2h 22m',
            rating: '9.3',
            quality: 'HD',
            poster: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=450&fit=crop',
            backdrop: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&h=1080&fit=crop',
            tagline: 'Fear can hold you prisoner. Hope can set you free.',
            description: 'Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.',
            genres: ['Drama'],
            cast: ['Tim Robbins', 'Morgan Freeman', 'Bob Gunton']
        }
    ]
};

window.Data = Data;
