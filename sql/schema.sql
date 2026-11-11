-- RecipeAppDB schema (SQL Server)
IF DB_ID('RecipeAppDB') IS NULL CREATE DATABASE RecipeAppDB;
GO
USE RecipeAppDB;
GO
IF OBJECT_ID('activity_logs') IS NOT NULL DROP TABLE activity_logs;
IF OBJECT_ID('notifications') IS NOT NULL DROP TABLE notifications;
IF OBJECT_ID('shopping_items') IS NOT NULL DROP TABLE shopping_items;
IF OBJECT_ID('meal_plans') IS NOT NULL DROP TABLE meal_plans;
IF OBJECT_ID('post_likes') IS NOT NULL DROP TABLE post_likes;
IF OBJECT_ID('posts') IS NOT NULL DROP TABLE posts;
IF OBJECT_ID('follows') IS NOT NULL DROP TABLE follows;
IF OBJECT_ID('reports') IS NOT NULL DROP TABLE reports;
IF OBJECT_ID('comment_likes') IS NOT NULL DROP TABLE comment_likes;
IF OBJECT_ID('ratings') IS NOT NULL DROP TABLE ratings;
IF OBJECT_ID('collection_items') IS NOT NULL DROP TABLE collection_items;
IF OBJECT_ID('collections') IS NOT NULL DROP TABLE collections;
IF OBJECT_ID('favorites') IS NOT NULL DROP TABLE favorites;
IF OBJECT_ID('recipe_steps') IS NOT NULL DROP TABLE recipe_steps;
IF OBJECT_ID('recipe_ingredients') IS NOT NULL DROP TABLE recipe_ingredients;
IF OBJECT_ID('recipes') IS NOT NULL DROP TABLE recipes;
IF OBJECT_ID('ingredients') IS NOT NULL DROP TABLE ingredients;
IF OBJECT_ID('categories') IS NOT NULL DROP TABLE categories;
IF OBJECT_ID('password_resets') IS NOT NULL DROP TABLE password_resets;
IF OBJECT_ID('users') IS NOT NULL DROP TABLE users;
GO
CREATE TABLE users (
  id INT IDENTITY PRIMARY KEY,
  username NVARCHAR(100) UNIQUE NOT NULL,
  email NVARCHAR(150) UNIQUE NOT NULL,
  password_hash NVARCHAR(200) NOT NULL,
  display_name NVARCHAR(150),
  avatar NVARCHAR(300) DEFAULT '/img/default-avatar.svg',
  bio NVARCHAR(MAX) DEFAULT '',
  role NVARCHAR(20) DEFAULT 'user',
  status NVARCHAR(20) DEFAULT 'active',
  verified INT DEFAULT 1,
  prefs NVARCHAR(MAX) DEFAULT '',
  created_at DATETIME DEFAULT GETDATE()
);
CREATE TABLE password_resets (
  id INT IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  token NVARCHAR(100) UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used INT DEFAULT 0
);
CREATE TABLE categories (
  id INT IDENTITY PRIMARY KEY,
  name NVARCHAR(100) UNIQUE NOT NULL,
  icon NVARCHAR(10) DEFAULT N'🍲'
);
CREATE TABLE ingredients (
  id INT IDENTITY PRIMARY KEY,
  name NVARCHAR(150) UNIQUE NOT NULL
);
CREATE TABLE recipes (
  id INT IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  title NVARCHAR(200) NOT NULL,
  description NVARCHAR(MAX) DEFAULT '',
  image NVARCHAR(300) DEFAULT '/img/food-placeholder.jpg',
  video_url NVARCHAR(300) DEFAULT '',
  category_id INT REFERENCES categories(id),
  country NVARCHAR(80) DEFAULT N'Việt Nam',
  prep_minutes INT DEFAULT 10,
  cook_minutes INT DEFAULT 20,
  servings INT DEFAULT 2,
  difficulty NVARCHAR(20) DEFAULT N'Dễ',
  calories INT DEFAULT 0,
  protein FLOAT DEFAULT 0, carbs FLOAT DEFAULT 0, fat FLOAT DEFAULT 0,
  diet NVARCHAR(30) DEFAULT '',
  is_public INT DEFAULT 1,
  approved INT DEFAULT 1,
  views INT DEFAULT 0,
  created_at DATETIME DEFAULT GETDATE()
);
CREATE TABLE recipe_ingredients (
  id INT IDENTITY PRIMARY KEY,
  recipe_id INT NOT NULL REFERENCES recipes(id),
  name NVARCHAR(150) NOT NULL,
  quantity NVARCHAR(50) DEFAULT '',
  unit NVARCHAR(50) DEFAULT ''
);
CREATE TABLE recipe_steps (
  id INT IDENTITY PRIMARY KEY,
  recipe_id INT NOT NULL REFERENCES recipes(id),
  step_order INT NOT NULL,
  text NVARCHAR(MAX) NOT NULL
);
CREATE TABLE favorites (
  user_id INT NOT NULL REFERENCES users(id),
  recipe_id INT NOT NULL REFERENCES recipes(id),
  PRIMARY KEY (user_id, recipe_id)
);
CREATE TABLE collections (
  id INT IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  name NVARCHAR(150) NOT NULL,
  share_token NVARCHAR(50) UNIQUE,
  created_at DATETIME DEFAULT GETDATE()
);
CREATE TABLE collection_items (
  collection_id INT NOT NULL REFERENCES collections(id),
  recipe_id INT NOT NULL REFERENCES recipes(id),
  PRIMARY KEY (collection_id, recipe_id)
);
CREATE TABLE ratings (
  rowid INT IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  recipe_id INT NOT NULL REFERENCES recipes(id),
  stars INT NOT NULL,
  comment NVARCHAR(MAX) DEFAULT '',
  photo NVARCHAR(300) DEFAULT '',
  parent_id INT NULL,
  created_at DATETIME DEFAULT GETDATE()
);
CREATE UNIQUE INDEX ux_ratings ON ratings(user_id, recipe_id);
CREATE TABLE comment_likes (
  user_id INT NOT NULL REFERENCES users(id),
  rating_id INT NOT NULL REFERENCES ratings(rowid),
  PRIMARY KEY (user_id, rating_id)
);
CREATE TABLE reports (
  id INT IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  rating_id INT NULL,
  recipe_id INT NULL,
  reason NVARCHAR(MAX) NOT NULL,
  status NVARCHAR(20) DEFAULT 'open',
  created_at DATETIME DEFAULT GETDATE()
);
CREATE TABLE follows (
  follower_id INT NOT NULL REFERENCES users(id),
  following_id INT NOT NULL REFERENCES users(id),
  PRIMARY KEY (follower_id, following_id)
);
CREATE TABLE posts (
  id INT IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  content NVARCHAR(MAX) NOT NULL,
  image NVARCHAR(300) DEFAULT '',
  recipe_id INT NULL REFERENCES recipes(id),
  likes INT DEFAULT 0,
  approved INT DEFAULT 1,
  created_at DATETIME DEFAULT GETDATE()
);
CREATE TABLE post_likes (
  user_id INT NOT NULL REFERENCES users(id),
  post_id INT NOT NULL REFERENCES posts(id),
  PRIMARY KEY (user_id, post_id)
);
CREATE TABLE meal_plans (
  id INT IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  slot NVARCHAR(10) NOT NULL,
  recipe_id INT NOT NULL REFERENCES recipes(id),
  done INT DEFAULT 0,
  CONSTRAINT uq_meal UNIQUE (date, slot, user_id)
);
CREATE TABLE shopping_items (
  id INT IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  name NVARCHAR(150) NOT NULL,
  quantity NVARCHAR(80) DEFAULT '',
  bought INT DEFAULT 0
);
CREATE TABLE notifications (
  id INT IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  type NVARCHAR(30) NOT NULL,
  message NVARCHAR(MAX) NOT NULL,
  link NVARCHAR(300) DEFAULT '',
  is_read INT DEFAULT 0,
  created_at DATETIME DEFAULT GETDATE()
);
CREATE TABLE activity_logs (
  id INT IDENTITY PRIMARY KEY,
  user_id INT NULL,
  action NVARCHAR(50) NOT NULL,
  detail NVARCHAR(MAX) DEFAULT '',
  created_at DATETIME DEFAULT GETDATE()
);
GO
PRINT 'Schema OK';
