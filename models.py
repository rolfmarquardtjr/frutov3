from app import db
from datetime import datetime

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)

    def __init__(self, description, amount, date):
        self.description = description
        self.amount = amount
        self.date = date if isinstance(date, datetime) else datetime.strptime(date, '%Y-%m-%d').date()

    def to_dict(self):
        return {
            'id': self.id,
            'description': self.description,
            'amount': self.amount,
            'date': self.date.strftime('%Y-%m-%d')
        }
