ALTER TABLE feed_keyspace.posts_by_user
    ADD media list<frozen<media_item>>;
