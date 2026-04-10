import BookCard from '@/components/BookCard'
import HeroSection from '@/components/HeroSection'


const books = [
    {
        _id: "1",
        title: "The Great Gatsby",
        author: "F. Scott Fitzgerald",
        coverURL: "/assets/great-gatsby-cover.png",
        slug: "the-great-gatsby"
    },
]

const page = () => {
  return (
    <main className='wrapper container'>
    <HeroSection />

      <div className="library-books-grid">
                {books.map((book) => (
                    <BookCard key={book._id} title={book.title} author={book.author} coverURL={book.coverURL} slug={book.slug} />
                ))}
            </div>
        
    </main>
  )
}

export default page
