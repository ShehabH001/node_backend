import pool from "../database/connection.mjs";
const gumballPool = pool.gumballPool;
const darwinPool = pool.darwinPool;

//////////////////// Testing /////////////////

import Category from "../models/Category.mjs";
import Author from "../models/Author.mjs";
import Publisher from "../models/Publisher.mjs";
import Translator from "../models/Translator.mjs";
import { validateCacheUtil } from "../utils/validateCache.mjs";
import Tag from "./Tag.mjs";

class Book {
  static async validateCache(book_ids, since) {
    return validateCacheUtil(
      "product_template",
      "id",
      "write_date",
      book_ids,
      since
    );
  }

  static async getAllBooks(limit, offset) {
    const query = `
    SELECT id FROM product_template 
    LIMIT $1 OFFSET $2
    `;
    const values = [limit, offset];
    const { rows } = await darwinPool.query(query, values);
    return rows;
  }

  static async getBookById(book_id, user_id) {
    const query = `SELECT * FROM product_template WHERE id = $1`;
    const values = [book_id];
    const { rows } = await darwinPool.query(query, values);
    if (rows.length === 0) {
      throw new Error(`Book with ID ${book_id} not found`);
    }
    const subData = await Book.getSubData(book_id, user_id);
    rows[0].sub_data = subData;
    return rows[0];
  }

  static async getBookByIds(book_ids, user_id) {
    const query = `SELECT * FROM product_template WHERE id = ANY($1)`;
    const values = [book_ids];
    const { rows } = await darwinPool.query(query, values);
    const subData = await Promise.all(
      rows.map((book) => Book.getSubData(book.id, user_id))
    );
    rows.forEach((book, index) => {
      book.sub_data = subData[index];
    });
    return rows;
  }

  static async findBookByName(book_name, limit, offset) {
    const query = `
    SELECT id
    FROM product_template
    WHERE EXISTS (
        SELECT 1
        FROM jsonb_each_text(name) AS j(key, value)
        WHERE value LIKE  $1
    ) 
    LIMIT $2 OFFSET $3`;
    const values = [`%${book_name}%`, limit, offset];
    const { rows } = await darwinPool.query(query, values);
    return rows;
  }

  static async findBookByAuthorName(author_name, limit, offset) {
    const query = `
    SELECT product_template.id FROM product_template
    JOIN 
      author_product_template_rel ON product_template.id = author_product_template_rel.product_template_id
    JOIN 
      author on author.id = author_product_template_rel.author_id
    WHERE 
      author.name LIKE $1
    LIMIT $2 OFFSET $3`;
    const values = [`%${author_name}%`, limit, offset];
    const { rows } = await darwinPool.query(query, values);
    return rows;
  }

  static async getBooksByTags(tag_id, limit, offset) {
    const query = `SELECT product_template.id from product_template 
    join product_tag_product_template_rel on product_template.id = product_tag_product_template_rel.product_template_id
    where product_tag_product_template_rel.product_tag_id = $1
    LIMIT $2 OFFSET $3`;
    const values = [tag_id, limit, offset];
    const { rows } = await darwinPool.query(query, values);
    return rows;
  }

  static async getBookByCategory(category_id, limit, offset) {
    const query = `SELECT product_template.id from product_template 
    join category_product_template_rel on product_template.id = category_product_template_rel.product_template_id
    where category_product_template_rel.category_id = $1
    LIMIT $2 OFFSET $3`;
    const values = [category_id, limit, offset];
    const { rows } = await darwinPool.query(query, values);
    return rows;
  }

  static async getBookByAuthor(author_id, limit, offset) {
    const query = `SELECT product_template.id from product_template 
    JOIN author_product_template_rel ON product_template.id = author_product_template_rel.product_template_id
    WHERE author_product_template_rel.author_id = $1
    limit $2 offset $3`;
    const values = [author_id, limit, offset];
    const { rows } = await darwinPool.query(query, values);
    return rows;
  }

  static async getBookMetadata(book_id) {
    const query = `SELECT * from book_metadata where book_id = $1`;
    const values = [book_id];
    const { rows } = await gumballPool.query(query, values);
    if (rows.length === 0) {
      throw new Error(`Metadata for book with ID ${book_id} not found`);
    }
    return rows[0];
  }

  static async addBookMetadata(book_id, metadata) {
    const query = `INSERT INTO book_metadata (book_id, page_count, chapter_count, book_encoding, book_index, target_links, text_direction)
    values ($1, $2, $3, $4, $5, $6, $7)`;
    const values = [
      book_id,
      metadata.page_count,
      metadata.chapter_count,
      metadata.book_encoding,
      metadata.book_index,
      metadata.target_links,
      metadata.text_direction,
    ];
    const result = await gumballPool.query(query, values);
    return result.rowCount > 0;
  }

  // static async getBookReviews(book_id) {
  //   const query = `SELECT * from review where book_id = $1`;
  //   const values = [book_id];
  //   const { rows } = await darwinPool.query(query, values);
  //   return rows;
  // }

  // static async getBookRating(book_id) {
  //   const query = `SELECT AVG(rating) as average_rating, COUNT(*) as total_reviews from review where book_id = $1`;
  //   const values = [book_id];
  //   const { rows } = await darwinPool.query(query, values);
  //   return rows[0] || { average_rating: 0, total_reviews: 0 };
  // }

  static async getBooksWithFlitter(request_body) {
    const { category_ids, tag_ids, author_ids, translator_ids, publisher_ids } =
      request_body;
    if (
      !category_ids &&
      !tag_ids &&
      !author_ids &&
      !translator_ids &&
      !publisher_ids
    ) {
      throw new Error("At least one filter must be provided");
    }

    const allCategories = await Category.getAllCategories(1000, 0);
    const allAuthors = await Author.getAllAuthors(1000, 0);
    const allTranslators = await Translator.getAllTranslators(1000, 0);
    const allPublishers = await Publisher.getAllPublishers(1000, 0);
    const allTags = await Tag.getAllTags(1000, 0);

    const query = `
    SELECT 
      id 
    FROM 
      product_template
    WHERE 
      (${
        !category_ids
          ? "TRUE"
          : `id IN (
        SELECT product_template_id 
        FROM category_product_template_rel 
        WHERE category_id = ANY($1)
      )`
      })
      OR
      (${
        !tag_ids
          ? "TRUE"
          : `id IN (
        SELECT product_template_id 
        FROM product_tag_product_template_rel 
        WHERE product_tag_id = ANY($2)
      )`
      })
      OR
      (${
        !author_ids
          ? "TRUE"
          : `id IN (
        SELECT product_template_id 
        FROM author_product_template_rel 
        WHERE author_id = ANY($3)
      )`
      })
      OR
      (${
        !translator_ids
          ? "TRUE"
          : `id IN (
        SELECT product_template_id 
        FROM product_template_translator_rel 
        WHERE translator_id = ANY($4)
      )`
      })
      OR
      (${!publisher_ids ? "TRUE" : `publisher_id = ANY($5)`})
  `;

    // Prepare values array only for provided filters
    const values = [];
    if (category_ids && category_ids.length !== 0) values.push(category_ids);
    else values.push(allCategories.map((cat) => cat.id));

    if (tag_ids && tag_ids.length !== 0) values.push(tag_ids);
    else values.push(allTags.map((tag) => tag.id));

    if (author_ids && author_ids.length !== 0) values.push(author_ids);
    else values.push(allAuthors.map((author) => author.id));

    if (translator_ids && translator_ids.length !== 0)
      values.push(translator_ids);
    else values.push(allTranslators.map((translator) => translator.id));

    if (publisher_ids && publisher_ids.length !== 0) values.push(publisher_ids);
    else values.push(allPublishers.map((publisher) => publisher.id));

    const { rows } = await darwinPool.query(query, values);
    return rows;
  }

  static async getBooksByPublisher(publisher_id, limit, offset) {
    const query = `select product_template.id from product_template where publisher_id = $1 limit $2 offset $3`;
    const values = [publisher_id, limit, offset];
    const { rows } = await darwinPool.query(query, values);
    return rows;
  }

  static async getBooksByTranslator(translator_id, limit, offset) {
    const query = `select product_template.id from product_template 
    join product_template_translator_rel on product_template.id = product_template_translator_rel.product_template_id
    where product_template_translator_rel.translator_id = $1
    limit $2 offset $3`;
    const values = [translator_id, limit, offset];
    const { rows } = await darwinPool.query(query, values);
    return rows;
  }

  static async updateReadingProgress(userId, bookId, reading_progress) {
    const query = `
      INSERT INTO reading_progress (user_id, book_id, progress)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, book_id) DO UPDATE
      SET progress = $3 `;
    const values = [userId, bookId, reading_progress];
    const result = await gumballPool.query(query, values);
    return result.rowCount > 0;
  }

  static async getReadingProgress(userId, bookId) {
    const query = `SELECT progress FROM reading_progress WHERE user_id = $1 AND book_id = $2`;
    const values = [userId, bookId];
    const { rows } = await gumballPool.query(query, values);
    if (rows.length === 0) 
      return 0; // Return 0 if no progress found
    return rows[0].progress; // Return 0 if no progress found
  }

  static async getBookRating(book_id) {
    const query = `SELECT AVG(rating) as average_rating, COUNT(*) as total_reviews FROM ih_rating_book WHERE book_id = $1`;
    const values = [book_id];
    const { rows } = await darwinPool.query(query, values);
    return rows[0] || { average_rating: 0, total_reviews: 0 };
  }

  static async getBookSize(book_id) {
    const query = `SELECT SUM(size) as size FROM token WHERE book_id = $1`;
    const values = [book_id];
    const { rows } = await gumballPool.query(query, values);
    if (rows[0].size === null) 
      return 0;
    return rows[0].size;
  }

  static async getBookSubscription(book_id){
    const query = `
     select * from stock_warehouse
     join product_template_stock_warehouse_rel on product_template_stock_warehouse_rel.stock_warehouse_id = stock_warehouse.id
     where product_template_stock_warehouse_rel.product_template_id = $1`;
    const values = [book_id];
    const { rows } = await darwinPool.query(query,values);
    return rows
  }

  static async getSubData(book_id, user_id) {
    const bookCategories = await Category.getBookCategories(book_id);
    const bookTags = await Tag.getBookTags(book_id);
    const bookAuthors = await Author.getBookAuthors(book_id);
    const bookPublisher = await Publisher.getBookPublisher(book_id);
    const bookTranslator = await Translator.getBookTranslators(book_id);
    const bookSize = await Book.getBookSize(book_id); /*1024 ;*/ // Placeholder for book size, replace with actual logic
    const bookRating = /*await Book.getBookRating(book_id);*/ { average_rating: 4.5, total_reviews: 100 };
    const bookReadingProgress = await Book.getReadingProgress(user_id, book_id); /*50 ;*/ // Placeholder for reading progress, replace with actual logic
    const bookSubscription = await Book.getBookSubscription(book_id);
    return {
      categories: bookCategories,
      tags: bookTags,
      authors: bookAuthors,
      publisher: bookPublisher,
      translators: bookTranslator,
      size: bookSize,
      rating: bookRating,
      reading_progress: bookReadingProgress,
      subscription: bookSubscription,
    };
  }

  /////////////// until here /////////////////////////

  static async addBook(book, tokens) {}

  static async updateBook(id, book) {}

  static async deleteBook(id) {}
}

export default Book;
