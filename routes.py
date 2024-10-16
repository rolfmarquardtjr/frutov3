from flask import jsonify, request, current_app
from app import app, db
from app.models import Expense
from datetime import datetime

# Código existente...

@app.before_request
def log_routes():
    current_app.logger.info(f"Rotas registradas: {app.url_map}")

@app.route('/expenses', methods=['GET'])
def get_expenses():
    expenses = Expense.query.all()
    return jsonify([expense.to_dict() for expense in expenses])

@app.route('/expense', methods=['POST'])
def add_expense():
    data = request.json
    try:
        new_expense = Expense(
            description=data['description'],
            amount=float(data['amount']),
            date=data['date']
        )
        db.session.add(new_expense)
        db.session.commit()
        return jsonify(new_expense.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/expense/<int:id>', methods=['DELETE'])
def delete_expense(id):
    expense = Expense.query.get(id)
    if not expense:
        return jsonify({'error': 'Despesa não encontrada'}), 404
    
    db.session.delete(expense)
    db.session.commit()
    return jsonify({'message': 'Despesa excluída com sucesso'})

@app.after_request
def add_header(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,DELETE'
    return response

# Código existente...
